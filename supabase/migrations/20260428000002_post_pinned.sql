-- ============================================================
-- PrivateSocial — Posts fixados no topo do feed
-- ============================================================
-- Admin pode fixar 1+ posts no topo do feed (anúncios, comunicados,
-- destaques). Posts fixados aparecem antes dos cronológicos pra todo
-- mundo, com badge "📌 Destaque".
--
-- Implementação simples: timestamp de quando foi fixado. Maior
-- timestamp aparece primeiro (mais recente "fixou" = mais alto).
-- Despinnar = setar pra null.
-- ============================================================

alter table public.posts
  add column if not exists pinned_em timestamptz;

create index if not exists idx_posts_pinned_em
  on public.posts(pinned_em desc) where pinned_em is not null;

comment on column public.posts.pinned_em is
  'Timestamp de quando o post foi fixado pelo admin. NULL = não fixado.';

NOTIFY pgrst, 'reload schema';
