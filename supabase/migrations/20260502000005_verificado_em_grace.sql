-- ============================================================
-- PrivateSocial — Coluna verificado_em + trigger automático
-- ============================================================
-- Pra implementar o grace period de fotos (5 dias pra postar 3 fotos
-- após aprovação), precisamos saber QUANDO o user foi aprovado.
-- Hoje só temos `profiles.verificado` (boolean) — sem timestamp.
--
-- Esta migration:
--  1. Adiciona profiles.verificado_em (timestamptz)
--  2. Backfill: pega revisado_em da última verificação aprovada
--  3. Fallback: pra users verificados sem registro (admins, etc),
--     usa created_at do profile
--  4. Trigger: seta verificado_em automaticamente quando verificado
--     muda de false → true
-- ============================================================

-- 1. Coluna
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verificado_em timestamptz;

COMMENT ON COLUMN public.profiles.verificado_em IS
  'Quando o admin aprovou a selfie. Usado pra grace period de fotos.';

-- 2. Backfill: pega revisado_em da última verificação aprovada de cada perfil
WITH ultimas AS (
  SELECT DISTINCT ON (profile_id) profile_id, revisado_em
  FROM public.verificacoes
  WHERE status = 'aprovado' AND revisado_em IS NOT NULL
  ORDER BY profile_id, revisado_em DESC
)
UPDATE public.profiles p
SET verificado_em = u.revisado_em
FROM ultimas u
WHERE p.id = u.profile_id
  AND p.verificado_em IS NULL
  AND p.verificado = true;

-- 3. Fallback: users verificados sem verificacao registrada (admins
-- aprovados na mão direto no banco, casos antigos) → usa created_at
UPDATE public.profiles
SET verificado_em = created_at
WHERE verificado = true AND verificado_em IS NULL;

-- 4. Trigger: seta verificado_em automaticamente quando verificado
-- vira true
CREATE OR REPLACE FUNCTION public.set_verificado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verificado = true AND (OLD.verificado IS DISTINCT FROM true) THEN
    NEW.verificado_em = COALESCE(NEW.verificado_em, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_verificado_em ON public.profiles;
CREATE TRIGGER profiles_set_verificado_em
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_verificado_em();
