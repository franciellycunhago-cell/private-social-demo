-- ============================================================
-- PrivateSocial — Aceite de termos no cadastro
-- ============================================================
-- Registra quando user aceitou Termos de Uso + Política de Privacidade.
-- Importante pra registro legal/LGPD.
-- ============================================================

alter table public.profiles
  add column if not exists termos_aceitos_em timestamptz;

comment on column public.profiles.termos_aceitos_em is
  'Timestamp de quando o user aceitou os Termos de Uso e Política de Privacidade no cadastro. NULL = legacy (cadastrado antes do checkbox).';

NOTIFY pgrst, 'reload schema';
