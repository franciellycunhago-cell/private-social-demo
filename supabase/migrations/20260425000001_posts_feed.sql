-- ============================================================
-- PrivateSocial — Feed de Posts (estilo Instagram)
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. posts: profile_id + texto (até 500) + counters denormalizados
--  2. posts_fotos: 1-10 fotos por post (bucket fotos-publicas)
--  3. posts_likes: like social (NÃO gera match, é separado de curtidas)
--  4. posts_comentarios + posts_comentarios_likes (mesmo padrão fotos)
--  5. Triggers de counter pra likes_count / comentarios_count no feed
--  6. RLS: SELECT pra todo authenticated; escrita só pelo dono
--     - INSERT em posts exige profile.verificado = true
-- ============================================================

-- 1. posts ------------------------------------------------------
create table if not exists public.posts (
  id                 uuid primary key default uuid_generate_v4(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  texto              text not null default '' check (char_length(texto) <= 500),
  likes_count        int  not null default 0,
  comentarios_count  int  not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_posts_profile_created
  on public.posts(profile_id, created_at desc);

create index if not exists idx_posts_created
  on public.posts(created_at desc);

-- 2. posts_fotos -----------------------------------------------
create table if not exists public.posts_fotos (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  url         text not null,
  ordem       int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_posts_fotos_post_ordem
  on public.posts_fotos(post_id, ordem);

-- Limite duro de 10 fotos por post
create or replace function public.posts_fotos_limit_check()
returns trigger language plpgsql as $$
declare cnt int;
begin
  select count(*) into cnt from public.posts_fotos where post_id = new.post_id;
  if cnt >= 10 then
    raise exception 'Post pode ter no máximo 10 fotos.';
  end if;
  return new;
end $$;

drop trigger if exists posts_fotos_limit on public.posts_fotos;
create trigger posts_fotos_limit
  before insert on public.posts_fotos
  for each row execute function public.posts_fotos_limit_check();

-- 3. posts_likes -----------------------------------------------
create table if not exists public.posts_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists idx_posts_likes_post on public.posts_likes(post_id);
create index if not exists idx_posts_likes_profile_created
  on public.posts_likes(profile_id, created_at desc);

-- Counter denormalizado de likes
create or replace function public.posts_likes_counter()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
       set likes_count = likes_count + 1
     where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
       set likes_count = greatest(0, likes_count - 1)
     where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists posts_likes_counter_ins on public.posts_likes;
create trigger posts_likes_counter_ins
  after insert on public.posts_likes
  for each row execute function public.posts_likes_counter();

drop trigger if exists posts_likes_counter_del on public.posts_likes;
create trigger posts_likes_counter_del
  after delete on public.posts_likes
  for each row execute function public.posts_likes_counter();

-- 4. posts_comentarios -----------------------------------------
create table if not exists public.posts_comentarios (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 280),
  created_at  timestamptz not null default now()
);

create index if not exists idx_posts_comentarios_post
  on public.posts_comentarios(post_id, created_at desc);

create index if not exists idx_posts_comentarios_profile
  on public.posts_comentarios(profile_id);

-- Counter de comentários
create or replace function public.posts_comentarios_counter()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
       set comentarios_count = comentarios_count + 1
     where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
       set comentarios_count = greatest(0, comentarios_count - 1)
     where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists posts_comentarios_counter_ins on public.posts_comentarios;
create trigger posts_comentarios_counter_ins
  after insert on public.posts_comentarios
  for each row execute function public.posts_comentarios_counter();

drop trigger if exists posts_comentarios_counter_del on public.posts_comentarios;
create trigger posts_comentarios_counter_del
  after delete on public.posts_comentarios
  for each row execute function public.posts_comentarios_counter();

-- 5. posts_comentarios_likes -----------------------------------
create table if not exists public.posts_comentarios_likes (
  comentario_id  uuid not null references public.posts_comentarios(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (comentario_id, profile_id)
);

create index if not exists idx_posts_comentarios_likes_comentario
  on public.posts_comentarios_likes(comentario_id);

-- 6. RLS --------------------------------------------------------
alter table public.posts                    enable row level security;
alter table public.posts_fotos              enable row level security;
alter table public.posts_likes              enable row level security;
alter table public.posts_comentarios        enable row level security;
alter table public.posts_comentarios_likes  enable row level security;

-- posts: SELECT pra todo authenticated
drop policy if exists "posts_select" on public.posts;
create policy "posts_select"
  on public.posts for select
  to authenticated
  using (true);

-- posts: INSERT exige verificado
drop policy if exists "posts_insert_verificado" on public.posts;
create policy "posts_insert_verificado"
  on public.posts for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and verificado = true
    )
  );

-- posts: DELETE só dono ou admin
drop policy if exists "posts_delete_autor_ou_admin" on public.posts;
create policy "posts_delete_autor_ou_admin"
  on public.posts for delete
  to authenticated
  using (
    profile_id = auth.uid() or public.is_admin()
  );

-- posts_fotos: SELECT se o post existe (post é público pra authenticated)
drop policy if exists "posts_fotos_select" on public.posts_fotos;
create policy "posts_fotos_select"
  on public.posts_fotos for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p where p.id = posts_fotos.post_id
    )
  );

-- posts_fotos: INSERT só dono do post
drop policy if exists "posts_fotos_insert_dono" on public.posts_fotos;
create policy "posts_fotos_insert_dono"
  on public.posts_fotos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = posts_fotos.post_id and p.profile_id = auth.uid()
    )
  );

-- posts_fotos: DELETE só dono do post ou admin
drop policy if exists "posts_fotos_delete_dono" on public.posts_fotos;
create policy "posts_fotos_delete_dono"
  on public.posts_fotos for delete
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = posts_fotos.post_id and p.profile_id = auth.uid()
    )
    or public.is_admin()
  );

-- posts_likes
drop policy if exists "posts_likes_select" on public.posts_likes;
create policy "posts_likes_select"
  on public.posts_likes for select
  to authenticated
  using (true);

drop policy if exists "posts_likes_insert_self" on public.posts_likes;
create policy "posts_likes_insert_self"
  on public.posts_likes for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "posts_likes_delete_self" on public.posts_likes;
create policy "posts_likes_delete_self"
  on public.posts_likes for delete
  to authenticated
  using (profile_id = auth.uid());

-- posts_comentarios
drop policy if exists "posts_comentarios_select" on public.posts_comentarios;
create policy "posts_comentarios_select"
  on public.posts_comentarios for select
  to authenticated
  using (true);

drop policy if exists "posts_comentarios_insert_self" on public.posts_comentarios;
create policy "posts_comentarios_insert_self"
  on public.posts_comentarios for insert
  to authenticated
  with check (profile_id = auth.uid());

-- DELETE: autor OU dono do post (moderar) OU admin
drop policy if exists "posts_comentarios_delete" on public.posts_comentarios;
create policy "posts_comentarios_delete"
  on public.posts_comentarios for delete
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = posts_comentarios.post_id and p.profile_id = auth.uid()
    )
    or public.is_admin()
  );

-- posts_comentarios_likes
drop policy if exists "posts_comentarios_likes_select" on public.posts_comentarios_likes;
create policy "posts_comentarios_likes_select"
  on public.posts_comentarios_likes for select
  to authenticated
  using (true);

drop policy if exists "posts_comentarios_likes_insert_self" on public.posts_comentarios_likes;
create policy "posts_comentarios_likes_insert_self"
  on public.posts_comentarios_likes for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "posts_comentarios_likes_delete_self" on public.posts_comentarios_likes;
create policy "posts_comentarios_likes_delete_self"
  on public.posts_comentarios_likes for delete
  to authenticated
  using (profile_id = auth.uid());
