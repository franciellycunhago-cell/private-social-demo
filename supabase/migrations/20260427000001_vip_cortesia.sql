-- ============================================================
-- PrivateSocial — Status 'cortesia' nas assinaturas
-- ============================================================
-- Permite admin dar VIP grátis pra qualquer user (parceiros,
-- embaixadores, ganhadores de sorteio, etc).
--
-- Diferença de uma assinatura paga:
--  - Não tem asaas_subscription_id (não passa por Asaas)
--  - Status = 'cortesia'
--  - profiles.vip_ate = expira_em (igual paga)
--  - Pode ter motivo no campo motivo_cancelamento (reaproveitando)
--    OU criar coluna nova `motivo_cortesia`
--
-- Decisão: criar `motivo_cortesia` separado pra clareza.
-- ============================================================

-- 1. Atualiza CHECK do status pra incluir 'cortesia'
alter table public.assinaturas
  drop constraint if exists assinaturas_status_check;

alter table public.assinaturas
  add constraint assinaturas_status_check
  check (status in (
    'trial',
    'ativa',
    'inadimplente',
    'cancelada',
    'expirada',
    'cortesia'
  ));

-- 2. Coluna pra registrar motivo + quem deu a cortesia
alter table public.assinaturas
  add column if not exists motivo_cortesia      text,
  add column if not exists cortesia_dada_por    uuid references public.profiles(id) on delete set null;

-- 3. Recarrega cache do PostgREST
NOTIFY pgrst, 'reload schema';
