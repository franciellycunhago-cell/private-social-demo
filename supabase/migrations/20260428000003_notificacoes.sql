-- ============================================================
-- PrivateSocial — Notificações in-app
-- ============================================================
-- Tabela pra histórico de notificações dentro do app (estilo
-- Instagram/D4): user vê em /app/notificacoes quem curtiu, comentou,
-- deu match, etc. Complementa o push (que chega no celular) — push
-- é o "alerta", a tabela é o "histórico".
--
-- Cada notificação tem:
--  - user_id: quem RECEBE
--  - actor_id: quem CAUSOU (opcional, ex: evento sistema)
--  - tipo: que tipo de evento foi
--  - post_id / comment_id / match_id: a entidade relacionada
--  - lida: flag se o user já viu (marcada quando ele abre a tela)
-- ============================================================

-- Enum dos tipos de notificação
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notificacao_tipo') then
    create type notificacao_tipo as enum (
      'curtiu_post',
      'comentou_post',
      'curtiu_perfil',
      'match',
      'mensagem',
      'pedido_privado',
      'pedido_aprovado',
      'evento_novo'
    );
  end if;
end$$;

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  tipo notificacao_tipo not null,
  post_id uuid,
  comment_id uuid,
  match_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index pra listagem cronológica (por user, mais recente primeiro)
create index if not exists idx_notificacoes_user_created
  on public.notificacoes(user_id, created_at desc);

-- Index parcial pra contagem de não-lidas (badge no bottom nav).
-- Parcial pra ficar pequeno mesmo com muitas notificações antigas.
create index if not exists idx_notificacoes_user_unread
  on public.notificacoes(user_id) where lida = false;

-- RLS
alter table public.notificacoes enable row level security;

-- User lê só as próprias
drop policy if exists "user_le_proprias_notificacoes" on public.notificacoes;
create policy "user_le_proprias_notificacoes"
  on public.notificacoes
  for select
  to authenticated
  using (user_id = auth.uid());

-- User marca as próprias como lidas
drop policy if exists "user_marca_propria_lida" on public.notificacoes;
create policy "user_marca_propria_lida"
  on public.notificacoes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Insert só via service role (não dar policy pra authenticated).
-- Isso impede que o user crie notificações falsas pra outras pessoas.

-- Realtime: pra atualizar badge em tempo real
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end$$;

comment on table public.notificacoes is
  'Histórico de notificações in-app — complementa push notifications.';

NOTIFY pgrst, 'reload schema';
