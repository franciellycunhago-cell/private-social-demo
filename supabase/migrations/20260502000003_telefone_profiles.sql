-- ============================================================
-- PrivateSocial — Telefone obrigatório no onboarding
-- ============================================================
-- Adiciona coluna telefone em profiles.
-- NOT NULL não é imposto no banco para não quebrar usuários
-- existentes; a obrigatoriedade é reforçada no onboarding.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text;

COMMENT ON COLUMN public.profiles.telefone IS
  'Celular brasileiro — preenchido obrigatoriamente no onboarding. Visível apenas para admins.';
