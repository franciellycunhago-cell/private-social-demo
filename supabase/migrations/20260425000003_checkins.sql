-- ============================================================
-- PrivateSocial — Check-in em eventos
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Adiciona:
--  1. stories.evento_id (FK opcional)  → story marcado com evento
--  2. checkins (profile_id, evento_id, expires_at)  → presença
-- ============================================================

-- Story marcado com evento (badge "📍 Evento X" no viewer)
alter table public.stories
  add column if not exists evento_id uuid
    references public.eventos(id) on delete set null;

create index if not exists idx_stories_evento
  on public.stories(evento_id);

-- Checkin: presença em evento por X horas
create table if not exists public.checkins (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (profile_id, evento_id)
);

create index if not exists idx_checkins_evento_expires
  on public.checkins(evento_id, expires_at desc);

create index if not exists idx_checkins_profile_expires
  on public.checkins(profile_id, expires_at desc);

-- RLS ----------------------------------------------------------
alter table public.checkins enable row level security;

drop policy if exists "checkins_select_all" on public.checkins;
create policy "checkins_select_all"
  on public.checkins for select to authenticated
  using (true);

drop policy if exists "checkins_insert_self" on public.checkins;
create policy "checkins_insert_self"
  on public.checkins for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "checkins_update_self" on public.checkins;
create policy "checkins_update_self"
  on public.checkins for update to authenticated
  using (profile_id = auth.uid());

drop policy if exists "checkins_delete_self" on public.checkins;
create policy "checkins_delete_self"
  on public.checkins for delete to authenticated
  using (profile_id = auth.uid() or public.is_admin());
