-- ============================================================
-- PrivateSocial — Status do usuário (suspensão + soft delete)
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Adiciona colunas em profiles pra admin gerenciar contas:
--   - suspenso: bloqueia login efetivamente (checado em
--     getProfileStatus)
--   - suspenso_em / suspenso_por / suspenso_motivo: auditoria
--   - deletado_em: soft delete; conta vira invisível pelos outros
--     mas dá pra reverter dentro do período de carência (7 dias).
--     Cron de limpeza apaga depois.
-- ============================================================

alter table public.profiles
  add column if not exists suspenso boolean not null default false;

alter table public.profiles
  add column if not exists suspenso_em timestamptz;

alter table public.profiles
  add column if not exists suspenso_motivo text;

alter table public.profiles
  add column if not exists suspenso_por uuid
    references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists deletado_em timestamptz;

create index if not exists idx_profiles_suspenso
  on public.profiles(suspenso) where suspenso = true;

create index if not exists idx_profiles_deletado
  on public.profiles(deletado_em) where deletado_em is not null;
