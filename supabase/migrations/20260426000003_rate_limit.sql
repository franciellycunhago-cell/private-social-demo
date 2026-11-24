-- ============================================================
-- PrivateSocial — Rate limit em ações sensíveis
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Tabela leve de eventos pra contar por bucket+identifier numa
-- janela de tempo. Helper no app insere uma linha por ação;
-- antes da próxima, conta as últimas X dentro da janela e bloqueia
-- se passou do limite.
--
-- Limpeza: cron periódico apaga eventos > 24h. Por enquanto fica
-- manual — quando passar de 1M linhas, criar pg_cron job.
-- ============================================================

create table if not exists public.rate_limit_events (
  bucket      text not null,
  identifier  text not null,
  created_at  timestamptz not null default now()
);

-- Index pra a query de contagem ser indexada
create index if not exists idx_rate_limit_lookup
  on public.rate_limit_events(bucket, identifier, created_at desc);

-- RLS: só service_role mexe (helpers do app usam adminClient)
alter table public.rate_limit_events enable row level security;

-- Sem policies pra authenticated → access negado por default.
-- Service role bypassa RLS.
