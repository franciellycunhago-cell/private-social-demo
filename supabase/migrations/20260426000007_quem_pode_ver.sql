-- ============================================================
-- PrivateSocial — Filtro "Quem pode te ver"
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona coluna `quem_pode_ver` jsonb em profiles. O dono do perfil
-- escolhe quais tipos podem visualizar. Default = todos true (não
-- muda comportamento existente).
--
-- Aplicado no descobrir/feed e no perfil direto. Match já existente
-- ignora o filtro (conversa em andamento não pode quebrar).
-- ============================================================

alter table public.profiles
  add column if not exists quem_pode_ver jsonb not null default jsonb_build_object(
    'casal', true,
    'homem', true,
    'mulher', true
  );

comment on column public.profiles.quem_pode_ver is
  'Quais tipos de perfil podem ver este perfil no descobrir / via link direto. Default todos true.';

-- Backfill defensivo
update public.profiles
   set quem_pode_ver = jsonb_build_object('casal', true, 'homem', true, 'mulher', true)
 where quem_pode_ver is null;
