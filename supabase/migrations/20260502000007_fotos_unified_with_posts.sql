-- ============================================================
-- PrivateSocial — Unificação: fotos públicas viram posts
-- ============================================================
-- O cliente decidiu simplificar a UX:
--  - Galeria de fotos públicas vira a timeline de posts
--  - Cada foto pública pendente vira um post automático
--  - Profile ganha foto_capa_path (lápis pra trocar)
--  - Fotos privadas continuam intocadas
--
-- Esta migration:
--  1. Adiciona profiles.foto_capa_path
--  2. Backfill: foto_capa_path = primeira foto pública ativa do user
--  3. Cria 1 post por foto pública ativa (texto vazio, mesmo created_at)
--  4. Soft-delete das fotos públicas migradas (arquivo no storage continua,
--     URL continua válida — capa não quebra)
--
-- Fotos privadas (tipo='privada') NÃO são tocadas.
-- ============================================================

-- 1. Nova coluna
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foto_capa_path text;

COMMENT ON COLUMN public.profiles.foto_capa_path IS
  'Path da foto de capa no bucket fotos-publicas. Resolver via getPublicUrl.';

-- 2. Backfill: foto_capa_path = primeira foto pública ativa
WITH primeira AS (
  SELECT DISTINCT ON (profile_id) profile_id, url
  FROM public.fotos
  WHERE tipo = 'publica' AND deletado_em IS NULL
  ORDER BY profile_id, ordem ASC, created_at ASC
)
UPDATE public.profiles p
SET foto_capa_path = pr.url
FROM primeira pr
WHERE p.id = pr.profile_id AND p.foto_capa_path IS NULL;

-- 3. Pra cada foto pública ativa SEM post equivalente, cria o post
DO $$
DECLARE
  foto_row RECORD;
  new_post_id uuid;
BEGIN
  FOR foto_row IN
    SELECT id, profile_id, url, created_at
    FROM public.fotos
    WHERE tipo = 'publica' AND deletado_em IS NULL
    ORDER BY profile_id, ordem ASC, created_at ASC
  LOOP
    -- Skip se essa URL já está em algum post_foto (ex: o user já postou ela manualmente antes)
    IF NOT EXISTS (
      SELECT 1 FROM public.posts_fotos WHERE url = foto_row.url
    ) THEN
      INSERT INTO public.posts (profile_id, texto, created_at, likes_count, comentarios_count)
      VALUES (foto_row.profile_id, '', foto_row.created_at, 0, 0)
      RETURNING id INTO new_post_id;

      INSERT INTO public.posts_fotos (post_id, url, ordem)
      VALUES (new_post_id, foto_row.url, 0);
    END IF;
  END LOOP;
END $$;

-- 4. Soft-delete das fotos públicas (já estão como posts agora).
-- Arquivo físico no storage NÃO é apagado — capa continua válida via
-- foto_capa_path. Admin ainda vê as rows pra auditoria.
UPDATE public.fotos
SET deletado_em = NOW()
WHERE tipo = 'publica' AND deletado_em IS NULL;
