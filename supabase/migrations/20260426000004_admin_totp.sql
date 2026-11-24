-- ============================================================
-- PrivateSocial — 2FA TOTP obrigatório pro admin
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Tabela admin_totp guarda:
--   - secret_base32: shared secret do TOTP (texto cleartext, mas
--     RLS bloqueia leitura por authenticated; só service_role lê
--     via adminClient)
--   - recovery_codes_hashed: array de hashes (sha256) de 10 códigos
--     de uso único pra recuperação se perder o celular
--   - last_verified_at: usado pelo admin layout pra decidir se
--     precisa cobrar TOTP de novo (sessão TOTP expira em 8h)
-- ============================================================

create table if not exists public.admin_totp (
  profile_id              uuid primary key references public.profiles(id) on delete cascade,
  secret_base32           text not null,
  recovery_codes_hashed   text[] not null default '{}',
  ativado_em              timestamptz not null default now(),
  last_verified_at        timestamptz
);

create index if not exists idx_admin_totp_verified
  on public.admin_totp(last_verified_at);

alter table public.admin_totp enable row level security;

-- Sem policies pra authenticated — só service_role bypassa RLS
-- via adminClient. Admin acessa via server actions assinadas.
