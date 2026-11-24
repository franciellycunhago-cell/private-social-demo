-- ============================================================
-- PrivateSocial — RPC pra busca de token de marca dágua
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- gte/lte de UUID via PostgREST não tava retornando match no
-- range esperado (provável quirk do parser). Função SQL
-- determinística com replace + LIKE no UUID em texto resolve.
--
-- security definer pra rodar com privilégios do owner; só
-- service_role chama via app, então grant restrito.
-- ============================================================

create or replace function public.admin_buscar_token(p_prefix text)
returns table (
  id              uuid,
  nome_exibicao   text,
  handle          text,
  cidade          text,
  estado          text,
  verificado      boolean,
  svip_ate        timestamptz,
  ultimo_ativo    timestamptz,
  trust_score     int
)
language sql
security definer
set search_path = public
as $$
  select id, nome_exibicao, handle, cidade, estado,
         verificado, svip_ate, ultimo_ativo, trust_score
  from public.profiles
  where upper(replace(id::text, '-', '')) like upper(p_prefix) || '%'
  limit 20;
$$;

revoke all on function public.admin_buscar_token(text) from public;
grant execute on function public.admin_buscar_token(text) to service_role;
