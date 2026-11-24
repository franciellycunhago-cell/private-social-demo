-- ============================================================
-- PrivateSocial — Separa posts com carrossel em posts individuais
-- ============================================================
-- O cliente decidiu remover o carrossel: cada foto = 1 post.
-- Esta migration faz a separação de dados existentes:
--  - Posts com 1 foto ou nenhuma: intactos
--  - Posts com N>1 fotos:
--     - Primeira foto fica no post original (preserva likes,
--       comentários, texto, pinned_em, created_at)
--     - Demais fotos viram posts NOVOS individuais (sem texto,
--       sem likes, mesmo profile_id, created_at 1ms anterior pra
--       manter ordem cronológica)
-- ============================================================

DO $$
DECLARE
  post_row RECORD;
  foto_row RECORD;
  new_post_id uuid;
  contador int;
BEGIN
  FOR post_row IN
    SELECT id, profile_id, created_at
    FROM public.posts
  LOOP
    SELECT count(*) INTO contador
    FROM public.posts_fotos
    WHERE post_id = post_row.id;

    IF contador > 1 THEN
      -- Pra cada foto EXTRA (ordem >= 1), cria um post novo e move a foto
      FOR foto_row IN
        SELECT id, url, ordem
        FROM public.posts_fotos
        WHERE post_id = post_row.id AND ordem >= 1
        ORDER BY ordem ASC
      LOOP
        INSERT INTO public.posts (
          profile_id,
          texto,
          created_at,
          likes_count,
          comentarios_count
        )
        VALUES (
          post_row.profile_id,
          '',
          post_row.created_at - (foto_row.ordem * INTERVAL '1 millisecond'),
          0,
          0
        )
        RETURNING id INTO new_post_id;

        -- Move a foto pro novo post
        UPDATE public.posts_fotos
        SET post_id = new_post_id, ordem = 0
        WHERE id = foto_row.id;
      END LOOP;
    END IF;
  END LOOP;
END $$;
