-- ============================================================
-- PrivateSocial — Fix trigger de match mútuo
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- BUG: `check_mutual_like` foi criada sem SECURITY DEFINER. Ela roda
-- como o usuário autenticado que inseriu a curtida, e esse user NÃO
-- tem permissão de INSERT em `matches` (a RLS só tem SELECT policy).
-- Resultado: curtidas mútuas não geravam matches silenciosamente.
--
-- FIX: recriar a function com SECURITY DEFINER + search_path fixo, que
-- é o padrão que todas as outras triggers já usam (handle_new_user,
-- create_conversa_for_match, bump_conversa_on_mensagem, mark_active).
--
-- BACKFILL: após o fix, este script encontra todas as curtidas mútuas
-- existentes que não geraram match e cria os matches em falta, de uma
-- vez só. Depois disso, qualquer nova curtida mútua vai criar match.
-- ============================================================

-- 1. Recria a function como SECURITY DEFINER ---------------------
create or replace function public.check_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p1 uuid;
  p2 uuid;
begin
  if exists (
    select 1 from public.curtidas
    where de_id = new.para_id and para_id = new.de_id
  ) then
    if new.de_id < new.para_id then
      p1 := new.de_id;
      p2 := new.para_id;
    else
      p1 := new.para_id;
      p2 := new.de_id;
    end if;

    insert into public.matches (profile_1, profile_2)
    values (p1, p2)
    on conflict (profile_1, profile_2) do nothing;
  end if;
  return new;
end;
$$;

-- Trigger continua existindo (ele só aponta pra function); não precisa
-- recriar. Mas vamos garantir.
drop trigger if exists curtidas_create_match on public.curtidas;
create trigger curtidas_create_match
  after insert on public.curtidas
  for each row execute function public.check_mutual_like();

-- 2. Backfill: encontra curtidas mútuas órfãs e cria os matches ---
-- Para cada par (A,B) onde A curtiu B E B curtiu A, se ainda não
-- existe match, cria agora (em ordem canônica profile_1 < profile_2).
insert into public.matches (profile_1, profile_2)
select distinct
  least(c1.de_id, c1.para_id)    as profile_1,
  greatest(c1.de_id, c1.para_id) as profile_2
from public.curtidas c1
join public.curtidas c2
  on c2.de_id = c1.para_id
  and c2.para_id = c1.de_id
where c1.de_id < c1.para_id  -- só o lado canônico, evita duplicar
on conflict (profile_1, profile_2) do nothing;

-- 3. Garante que os matches backfilled também tenham conversa -----
-- O trigger `matches_create_conversa` (Semana 4) só dispara em INSERTs
-- novos. Vamos rodar o backfill de conversas de novo.
insert into public.conversas (match_id)
select m.id
from public.matches m
left join public.conversas c on c.match_id = m.id
where c.id is null;
