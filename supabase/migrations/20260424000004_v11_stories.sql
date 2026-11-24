-- ============================================================
-- PrivateSocial — v1.1 (Stories)
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. Tabela `stories` + RLS (owner vê sempre, matches veem se não
--     expirou)
--  2. Tabela `stories_views` pra "quem já viu"
--  3. Bucket `stories` privado + policies
-- ============================================================

-- 1. Tabela stories ---------------------------------------------
create table if not exists public.stories (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  media_url   text not null,
  texto       text check (texto is null or char_length(texto) <= 200),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_stories_profile
  on public.stories(profile_id, created_at desc);

-- Nota: não usa partial index com `where expires_at > now()` porque
-- now() é STABLE (não IMMUTABLE), e Postgres exige IMMUTABLE em index
-- predicates. Índice normal em expires_at desc cobre os range scans
-- do tipo `where expires_at > now()` igualmente bem.
create index if not exists idx_stories_expires_at
  on public.stories(expires_at desc);

-- 2. Tabela stories_views ---------------------------------------
create table if not exists public.stories_views (
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists idx_stories_views_story
  on public.stories_views(story_id);

-- 3. RLS --------------------------------------------------------
alter table public.stories       enable row level security;
alter table public.stories_views enable row level security;

-- Dono lê sempre; matches leem se story não expirou
drop policy if exists "stories_select_owner" on public.stories;
create policy "stories_select_owner"
  on public.stories for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "stories_select_match" on public.stories;
create policy "stories_select_match"
  on public.stories for select
  to authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.matches m
      where (m.profile_1 = auth.uid() and m.profile_2 = stories.profile_id)
         or (m.profile_2 = auth.uid() and m.profile_1 = stories.profile_id)
    )
  );

-- Só o dono posta
drop policy if exists "stories_insert_self" on public.stories;
create policy "stories_insert_self"
  on public.stories for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "stories_delete_self" on public.stories;
create policy "stories_delete_self"
  on public.stories for delete
  to authenticated
  using (profile_id = auth.uid());

-- Views: user só insere sua própria linha (viewer_id = auth.uid())
drop policy if exists "stories_views_insert_self" on public.stories_views;
create policy "stories_views_insert_self"
  on public.stories_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- Dono do story vê quem viu; viewer vê as próprias linhas
drop policy if exists "stories_views_select_owner_or_self" on public.stories_views;
create policy "stories_views_select_owner_or_self"
  on public.stories_views for select
  to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = stories_views.story_id and s.profile_id = auth.uid()
    )
  );

-- 4. Storage bucket `stories` (privado, signed URLs) ------------
insert into storage.buckets (id, name, public)
values ('stories', 'stories', false)
on conflict (id) do nothing;

-- Upload só no próprio path
drop policy if exists "stories_storage_insert_self" on storage.objects;
create policy "stories_storage_insert_self"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "stories_storage_delete_self" on storage.objects;
create policy "stories_storage_delete_self"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: dono vê os próprios arquivos; matches veem (signed URLs
-- vêm do server action, mas a policy deixa explícito).
drop policy if exists "stories_storage_select_match" on storage.objects;
create policy "stories_storage_select_match"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'stories'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.stories s
        join public.matches m on
          (m.profile_1 = auth.uid() and m.profile_2 = s.profile_id)
          or (m.profile_2 = auth.uid() and m.profile_1 = s.profile_id)
        where s.media_url = storage.objects.name
          and s.expires_at > now()
      )
    )
  );
