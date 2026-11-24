-- ============================================================
-- PrivateSocial — Preferências de notificação
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona coluna `notif_prefs` jsonb em profiles. Cada toggle
-- corresponde a um tipo de evento que dispara push:
--   - matches:               curtida mútua
--   - mensagens:              mensagens novas em conversas
--   - curtidas_post:          alguém curtiu seu post
--   - comentarios_post:       alguém comentou seu post
--   - curtida_recebida:       alguém te curtiu (sem ser mutuo ainda)
--   - eventos_novos:          o admin lançou evento na sua cidade
--
-- Default = todos ativos. RLS deixa o próprio user atualizar.
-- ============================================================

alter table public.profiles
  add column if not exists notif_prefs jsonb not null default jsonb_build_object(
    'matches', true,
    'mensagens', true,
    'curtidas_post', true,
    'comentarios_post', true,
    'curtida_recebida', true,
    'eventos_novos', true
  );

comment on column public.profiles.notif_prefs is
  'Preferências de notificação push. JSON com flags booleanas por tipo de evento.';

-- Backfill seguro pra contas pré-existentes (NOT NULL DEFAULT já cuida,
-- mas garante caso alguém tenha rodado SET NULL via update direto)
update public.profiles
   set notif_prefs = jsonb_build_object(
     'matches', true,
     'mensagens', true,
     'curtidas_post', true,
     'comentarios_post', true,
     'curtida_recebida', true,
     'eventos_novos', true
   )
 where notif_prefs is null;
