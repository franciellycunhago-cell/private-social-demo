-- ============================================================
-- PrivateSocial — Curtidas em fotos da galeria (públicas + privadas)
-- ============================================================
-- Hoje só dá pra curtir POSTS. Faltava poder curtir as FOTOS da
-- galeria do perfil — públicas e privadas. Mesmo schema dos
-- posts_likes: tabela junction + counter denormalizado + RLS.
--
-- Roda no SQL Editor do Supabase.
-- ============================================================

-- 1. Counter denormalizado em fotos -----------------------------
alter table public.fotos
  add column if not exists likes_count int not null default 0;

-- 2. Tabela junction curtidas_foto ------------------------------
create table if not exists public.curtidas_foto (
  foto_id     uuid not null references public.fotos(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (foto_id, profile_id)
);

create index if not exists idx_curtidas_foto_foto
  on public.curtidas_foto(foto_id);
create index if not exists idx_curtidas_foto_profile_created
  on public.curtidas_foto(profile_id, created_at desc);

-- 3. Trigger pra manter likes_count em fotos --------------------
create or replace function public.curtidas_foto_counter()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.fotos
       set likes_count = likes_count + 1
     where id = new.foto_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.fotos
       set likes_count = greatest(0, likes_count - 1)
     where id = old.foto_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists curtidas_foto_counter_ins on public.curtidas_foto;
create trigger curtidas_foto_counter_ins
  after insert on public.curtidas_foto
  for each row execute function public.curtidas_foto_counter();

drop trigger if exists curtidas_foto_counter_del on public.curtidas_foto;
create trigger curtidas_foto_counter_del
  after delete on public.curtidas_foto
  for each row execute function public.curtidas_foto_counter();

-- 4. RLS --------------------------------------------------------
alter table public.curtidas_foto enable row level security;

drop policy if exists "curtidas_foto_select" on public.curtidas_foto;
create policy "curtidas_foto_select"
  on public.curtidas_foto for select
  to authenticated
  using (true);

drop policy if exists "curtidas_foto_insert_self" on public.curtidas_foto;
create policy "curtidas_foto_insert_self"
  on public.curtidas_foto for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "curtidas_foto_delete_self" on public.curtidas_foto;
create policy "curtidas_foto_delete_self"
  on public.curtidas_foto for delete
  to authenticated
  using (profile_id = auth.uid());

-- 5. Realtime ---------------------------------------------------
do $$
begin
  perform 1
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'curtidas_foto';
  if not found then
    alter publication supabase_realtime add table public.curtidas_foto;
  end if;
end $$;

-- 6. Adiciona 'curtiu_foto' ao enum de notificações + coluna foto_id
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'curtiu_foto'
      and enumtypid = (select oid from pg_type where typname = 'notificacao_tipo')
  ) then
    alter type notificacao_tipo add value 'curtiu_foto';
  end if;
end $$;

alter table public.notificacoes
  add column if not exists foto_id uuid;
