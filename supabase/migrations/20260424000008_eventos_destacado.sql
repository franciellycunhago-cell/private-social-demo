-- ============================================================
-- PrivateSocial — Destaque de evento
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. eventos.destacado boolean
--     - Evento marcado como destacado aparece no hero grande do
--       /app/eventos e no banner rotativo do /app/descobrir
--     - A lógica de "só 1 destacado" é enforced no server action
--       (saveEvento desativa os outros quando marca um novo)
-- ============================================================

alter table public.eventos
  add column if not exists destacado boolean not null default false;

create index if not exists idx_eventos_destacado
  on public.eventos(destacado) where destacado = true;
