-- ============================================================
-- PrivateSocial — Soft delete em fotos
-- ============================================================
-- Problema: deletePhoto apagava o registro da tabela fotos +
-- o objeto do storage de forma permanente. Se o usuário deletava
-- as fotos antes/durante a exclusão da conta, o admin perdia o
-- histórico para fins de moderação/auditoria.
--
-- Solução: adicionar deletado_em em fotos.
--  - Usuário "deleta" → seta deletado_em, storage é removido (UX igual)
--  - Admin sempre vê todas as fotos (incluindo deletadas) com badge
--  - Queries públicas filtram deletado_em IS NULL
--  - FK profile_id mantém cascade (corrigido na próxima migration se necessário)
-- ============================================================

-- 1. Adiciona coluna deletado_em em fotos ----------------------
ALTER TABLE public.fotos
  ADD COLUMN IF NOT EXISTS deletado_em timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_fotos_deletado
  ON public.fotos(profile_id)
  WHERE deletado_em IS NULL;

-- 2. Atualiza RLS: usuário só vê as próprias fotos não deletadas
-- Admin vê tudo. Fotos públicas de outros: só não deletadas.
DROP POLICY IF EXISTS "fotos_select" ON public.fotos;

CREATE POLICY "fotos_select"
  ON public.fotos FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      deletado_em IS NULL
      AND (
        tipo = 'publica'
        OR profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.pedidos_privado
          WHERE solicitante_id = auth.uid()
            AND alvo_id = fotos.profile_id
            AND status = 'aprovado'
        )
      )
    )
    OR (profile_id = auth.uid()) -- dono vê as próprias mesmo deletadas (pra UX de "foto deletada")
  );
