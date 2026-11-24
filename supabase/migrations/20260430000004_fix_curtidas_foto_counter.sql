-- ============================================================
-- Fix: curtidas_foto_counter precisa de SECURITY DEFINER
-- ============================================================
-- BUG: a function curtidas_foto_counter foi criada sem SECURITY
-- DEFINER. Roda como o user que inseriu na curtidas_foto, e esse
-- user NÃO tem permissão de UPDATE em `fotos` (foto pertence ao
-- dono). Resultado: trigger atualiza nada em silêncio, likes_count
-- continua zerado mesmo com curtida real na tabela.
--
-- Mesma raiz do bug histórico de `check_mutual_like` (corrigido em
-- 20260424000002). Padrão das outras triggers do projeto:
-- security definer + search_path = public.
--
-- Faz também backfill do likes_count baseado nas rows que já existem
-- em curtidas_foto (curtidas que aconteceram antes do fix).
-- ============================================================

create or replace function public.curtidas_foto_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.fotos
       set likes_count = likes_count + 1
     where id = new.foto_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.fotos
       set likes_count = greatest(0, likes_count - 1)
     where id = old.foto_id;
    return old;
  end if;
  return null;
end $$;

-- Backfill: recalcula likes_count baseado em rows existentes em
-- curtidas_foto (idempotente — pode rodar quantas vezes precisar).
update public.fotos f
   set likes_count = coalesce(c.cnt, 0)
  from (
    select foto_id, count(*)::int as cnt
      from public.curtidas_foto
     group by foto_id
  ) c
 where c.foto_id = f.id;

-- Zera fotos sem nenhuma curtida (caso tivessem ficado com lixo)
update public.fotos
   set likes_count = 0
 where id not in (select foto_id from public.curtidas_foto)
   and likes_count <> 0;
