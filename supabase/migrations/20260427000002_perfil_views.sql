-- ============================================================
-- PrivateSocial — Visualizações de perfil (VIP feature)
-- ============================================================
-- "Quem visitou seu perfil" — feature VIP clássica de apps
-- de relacionamento.
--
-- Anti-spam: 1 view por par (visitante_id, perfil_id). Visitas
-- repetidas atualizam `ultima_visita` em vez de duplicar.
--
-- Privacidade: admin não registra view (modo invisível pra
-- moderação). Próprio user também não — não tem sentido.
--
-- RLS: só dono do perfil vê seus visitantes. Admin vê tudo.
--
-- Cleanup: views > 30 dias devem ser deletadas via cron futuro.
-- Por enquanto a página filtra na query (where ultima_visita > now()-30d).
-- ============================================================

create table if not exists public.perfil_views (
  visitante_id    uuid not null references public.profiles(id) on delete cascade,
  perfil_id       uuid not null references public.profiles(id) on delete cascade,
  ultima_visita   timestamptz not null default now(),
  primary key (visitante_id, perfil_id),
  check (visitante_id <> perfil_id)
);

create index if not exists idx_perfil_views_perfil_data
  on public.perfil_views(perfil_id, ultima_visita desc);

create index if not exists idx_perfil_views_visitante
  on public.perfil_views(visitante_id);

-- RLS
alter table public.perfil_views enable row level security;

-- SELECT: dono do perfil vê quem o visitou. Admin tbm.
drop policy if exists "perfil_views_select_dono" on public.perfil_views;
create policy "perfil_views_select_dono"
  on public.perfil_views for select
  to authenticated
  using (perfil_id = auth.uid() or public.is_admin());

-- INSERT/UPDATE: o próprio visitante registra
drop policy if exists "perfil_views_insert_self" on public.perfil_views;
create policy "perfil_views_insert_self"
  on public.perfil_views for insert
  to authenticated
  with check (visitante_id = auth.uid());

drop policy if exists "perfil_views_update_self" on public.perfil_views;
create policy "perfil_views_update_self"
  on public.perfil_views for update
  to authenticated
  using (visitante_id = auth.uid())
  with check (visitante_id = auth.uid());
