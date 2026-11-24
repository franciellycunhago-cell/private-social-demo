-- ============================================================
-- PrivateSocial — Trigger: verificado exige selfie aprovada
-- ============================================================
-- Problema identificado 02/05: perfis foram aprovados (verificado=true)
-- sem ter selfie aprovada na tabela verificacoes. Isso permite que
-- usuários entrem no feed sem nenhuma verificação de identidade.
--
-- Esta migration cria:
--  1. Trigger BEFORE UPDATE em profiles:
--     - quando verificado vai de false→true, exige que exista
--       ao menos 1 registro em verificacoes com status='aprovado'
--       para aquele profile_id
--     - bloqueia com EXCEPTION caso não exista
--
-- Idempotente: usa CREATE OR REPLACE + DROP IF EXISTS.
-- ============================================================

-- 1. Função do trigger ------------------------------------------
CREATE OR REPLACE FUNCTION public.check_verificado_requires_selfie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só valida quando verificado está sendo setado para true
  -- e antes era false (ou null)
  IF NEW.verificado = true AND (OLD.verificado IS NULL OR OLD.verificado = false) THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.verificacoes
       WHERE profile_id = NEW.id
         AND status = 'aprovado'
    ) THEN
      RAISE EXCEPTION
        'Perfil % não pode ser verificado: nenhuma selfie aprovada em verificacoes.',
        NEW.id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Cria o trigger --------------------------------------------
DROP TRIGGER IF EXISTS profiles_verificado_requires_selfie ON public.profiles;

CREATE TRIGGER profiles_verificado_requires_selfie
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_verificado_requires_selfie();

-- 3. Auditoria: quantos perfis verificados não têm selfie aprovada
-- (só pra diagnóstico — não bloqueia nada, apenas registra)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)::int INTO v_count
    FROM public.profiles p
   WHERE p.verificado = true
     AND NOT EXISTS (
       SELECT 1 FROM public.verificacoes v
        WHERE v.profile_id = p.id
          AND v.status = 'aprovado'
     );

  IF v_count > 0 THEN
    RAISE WARNING
      '⚠ % perfil(s) com verificado=true mas sem selfie aprovada. Revisar manualmente.',
      v_count;
  ELSE
    RAISE NOTICE '✓ Nenhum perfil com verificado=true sem selfie aprovada.';
  END IF;
END;
$$;
