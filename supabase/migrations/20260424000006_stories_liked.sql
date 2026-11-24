-- ============================================================
-- PrivateSocial — Stories podem ser curtidas
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. stories_views.liked boolean
--     (usa a mesma linha de "visto" pra guardar like, evita nova tabela)
--  2. RPC set_story_like(story_id, liked) — upsert atômico da view
--     com liked = true/false. Necessário porque o user pode curtir
--     sem ter aberto o viewer (scroll no carrossel), e vice-versa.
-- ============================================================

alter table public.stories_views
  add column if not exists liked boolean not null default false;

create index if not exists idx_stories_views_liked
  on public.stories_views(story_id, liked);

-- RPC: upsert da linha de view + set liked.
-- Security definer porque roda via RLS do próprio user (validamos
-- auth.uid() dentro).
create or replace function public.set_story_like(
  p_story_id uuid,
  p_liked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.stories_views (story_id, viewer_id, liked)
  values (p_story_id, auth.uid(), p_liked)
  on conflict (story_id, viewer_id) do update
    set liked = excluded.liked;
end;
$$;

grant execute on function public.set_story_like(uuid, boolean) to authenticated;
