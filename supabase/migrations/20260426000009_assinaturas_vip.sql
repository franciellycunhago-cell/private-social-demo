-- ============================================================
-- PrivateSocial — Assinaturas VIP + tracking de funil
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- 2 tabelas:
--   1. assinaturas — histórico/estado das assinaturas no Asaas
--   2. vip_eventos — tracking simples do funil de conversão
--      (page → trial → pago → cancelado)
--
-- Quando o webhook Asaas confirma pagamento, atualiza
-- profiles.vip_ate (já existente após migration 20260426000008).
-- ============================================================

-- 1. assinaturas -------------------------------------------------
create table if not exists public.assinaturas (
  id                       uuid primary key default uuid_generate_v4(),
  profile_id               uuid not null references public.profiles(id) on delete cascade,

  -- Identificadores Asaas
  asaas_customer_id        text,
  asaas_subscription_id    text unique,        -- pode ser null durante trial sem cobrança ainda

  -- Plano
  plano                    text not null check (plano in ('mensal', 'trimestral', 'anual')),
  valor_centavos           int  not null,      -- 990, 2490, 8990

  -- Estado
  status                   text not null check (status in (
    'trial',          -- 7 dias grátis em curso
    'ativa',          -- pagando regularmente
    'inadimplente',   -- pagamento atrasado
    'cancelada',      -- cancelou (mantém acesso até expira_em)
    'expirada'        -- não renovou + venceu
  )),

  -- Datas
  trial_inicio_em          timestamptz,
  trial_fim_em             timestamptz,
  ativada_em               timestamptz,        -- 1ª cobrança confirmada
  expira_em                timestamptz,        -- vip_ate efetivo
  cancelada_em             timestamptz,
  motivo_cancelamento      text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_assinaturas_profile on public.assinaturas(profile_id);
create index if not exists idx_assinaturas_status  on public.assinaturas(status);
create index if not exists idx_assinaturas_asaas_sub on public.assinaturas(asaas_subscription_id) where asaas_subscription_id is not null;

-- Trigger pra updated_at
create or replace function public.assinaturas_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists assinaturas_updated_at on public.assinaturas;
create trigger assinaturas_updated_at
  before update on public.assinaturas
  for each row execute function public.assinaturas_set_updated_at();

-- RLS
alter table public.assinaturas enable row level security;

-- User vê só a própria assinatura
drop policy if exists "assinaturas_select_self" on public.assinaturas;
create policy "assinaturas_select_self"
  on public.assinaturas for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- INSERT/UPDATE só via service role (webhook + server actions com adminClient)
-- Não criamos policy de insert/update pra authenticated — bloqueado por padrão.

-- 2. vip_eventos -------------------------------------------------
-- Tracking minimalista do funil. Cada evento é uma linha.
-- Pra agregação no /admin/assinaturas: count distinct profile_id por
-- tipo, ou conversão entre 2 tipos consecutivos.
create table if not exists public.vip_eventos (
  id              bigserial primary key,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  tipo            text not null check (tipo in (
    'page_visitada',           -- abriu /app/vip
    'trial_iniciado',          -- confirmou começar 7 dias
    'pagamento_confirmado',    -- webhook Asaas (pós-trial ou imediato)
    'renovacao_confirmada',    -- pagamento recorrente
    'cancelado_no_trial',      -- saiu antes dos 7 dias
    'cancelado_pos_trial',     -- saiu depois de pagar ao menos 1x
    'inadimplente'             -- webhook Asaas falhou
  )),
  metadata        jsonb,        -- ex: { plano: 'mensal', motivo: 'caro' }
  created_at      timestamptz not null default now()
);

create index if not exists idx_vip_eventos_profile_created
  on public.vip_eventos(profile_id, created_at desc);
create index if not exists idx_vip_eventos_tipo
  on public.vip_eventos(tipo, created_at desc);

-- RLS
alter table public.vip_eventos enable row level security;

-- Só admin lê (analytics)
drop policy if exists "vip_eventos_select_admin" on public.vip_eventos;
create policy "vip_eventos_select_admin"
  on public.vip_eventos for select
  to authenticated
  using (public.is_admin());

-- INSERT pelo próprio user (registra page_visitada e trial_iniciado).
-- Resto é via service role.
drop policy if exists "vip_eventos_insert_self" on public.vip_eventos;
create policy "vip_eventos_insert_self"
  on public.vip_eventos for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and tipo in ('page_visitada', 'trial_iniciado')
  );
