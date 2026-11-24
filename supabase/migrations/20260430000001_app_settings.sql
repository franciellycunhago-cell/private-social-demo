-- ============================================================
-- PrivateSocial — Tabela de configurações globais do app
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Tabela key/value pra feature flags e configs runtime que admin
-- consegue mexer pelo /admin sem precisar deploy. Primeiro uso:
-- chat_aberto — quando true, qualquer user pode abrir conversa com
-- qualquer outro user mesmo sem match. Útil pro early stage onde
-- queremos forçar interação. Quando atingir massa crítica, admin
-- desliga e volta pro modo "só com match".
-- ============================================================

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Seed inicial: chat aberto pra todo mundo (decisão de produto 30/04)
insert into public.app_settings (key, value)
values ('chat_aberto', 'true'::jsonb)
on conflict (key) do nothing;

-- RLS: leitura aberta pra qualquer user autenticado (precisa pra
-- decidir se mostra o botão "Conversar"). Escrita só via service role
-- — nenhuma policy de INSERT/UPDATE/DELETE significa que client
-- comum não consegue alterar.
alter table public.app_settings enable row level security;

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select
  to authenticated
  using (true);
