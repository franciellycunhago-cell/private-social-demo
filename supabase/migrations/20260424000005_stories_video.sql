-- ============================================================
-- PrivateSocial — Stories suportam vídeo
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. stories.media_tipo ('imagem' | 'video')
--  2. stories.duracao_ms (pro progress bar saber quanto tempo esperar)
-- ============================================================

alter table public.stories
  add column if not exists media_tipo text not null default 'imagem';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stories_media_tipo_check'
  ) then
    alter table public.stories
      add constraint stories_media_tipo_check
      check (media_tipo in ('imagem', 'video'));
  end if;
end $$;

alter table public.stories
  add column if not exists duracao_ms integer;
