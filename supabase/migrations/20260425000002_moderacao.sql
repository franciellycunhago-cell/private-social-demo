-- ============================================================
-- PrivateSocial — Bloqueios (denúncias já existem desde initial_schema)
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- A tabela `denuncias` já foi criada na 20260421000001_initial_schema:
--   denunciado_id, descricao, status enum (aberta|em_analise|resolvida),
--   policies denuncias_insert_self e denuncias_select_admin já ativas.
-- Esta migration adiciona apenas:
--  - bloqueios (relação direcional, mútua via app)
--  - índice em denunciado_id (pra moderação consultar por alvo)
-- ============================================================

create table if not exists public.bloqueios (
  de_id       uuid not null references public.profiles(id) on delete cascade,
  para_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (de_id, para_id),
  check (de_id <> para_id)
);

create index if not exists idx_bloqueios_para
  on public.bloqueios(para_id);

create index if not exists idx_denuncias_denunciado
  on public.denuncias(denunciado_id);

-- RLS bloqueios -----------------------------------------------
alter table public.bloqueios enable row level security;

drop policy if exists "bloqueios_select_envolvido" on public.bloqueios;
create policy "bloqueios_select_envolvido"
  on public.bloqueios for select to authenticated
  using (de_id = auth.uid() or para_id = auth.uid() or public.is_admin());

drop policy if exists "bloqueios_insert_self" on public.bloqueios;
create policy "bloqueios_insert_self"
  on public.bloqueios for insert to authenticated
  with check (de_id = auth.uid());

drop policy if exists "bloqueios_delete_self" on public.bloqueios;
create policy "bloqueios_delete_self"
  on public.bloqueios for delete to authenticated
  using (de_id = auth.uid());
