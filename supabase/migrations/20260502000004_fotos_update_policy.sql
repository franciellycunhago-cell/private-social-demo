-- ============================================================
-- PrivateSocial — Policy UPDATE em fotos (ausente desde o schema inicial)
-- ============================================================
-- Problema: reorderPhotos e deletePhoto (soft-delete) chamam
-- UPDATE na tabela fotos, mas não existia policy de UPDATE.
-- O Supabase bloqueia silenciosamente → 0 linhas afetadas, sem erro.
-- Resultado: reordenar fotos revertia ao estado original e
--            soft-delete (deletado_em) não persistia.
-- ============================================================

CREATE POLICY "fotos_update_self"
  ON public.fotos FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
