-- ============================================================
-- PrivateSocial — Radar de proximidade (geolocalização)
-- ============================================================
-- Adiciona busca por proximidade entre users.
-- Decisão de produto (30/04, fase de teste com poucos users):
--   - Default OPT-OUT: geo_visivel=true por padrão (todo user
--     novo aparece no radar). Toggle em /app/perfil/ajustes.
--   - Distância EXATA por enquanto (depois pode virar faixa).
--   - FREE pra MVP, pode virar VIP-only depois.
--
-- Implementação:
--   1. Extensão PostGIS pra cálculos de distância
--   2. Coluna profiles.geo_loc (geography Point WGS84)
--   3. Coluna profiles.geo_atualizado_em (timestamp)
--   4. Coluna profiles.geo_visivel (toggle privacidade)
--   5. Índice GIST pra busca espacial
--   6. RPC radar_perfis_proximos(lat, lng, raio_km, limit)
--      retorna perfis ordenados por distância, com filtros do
--      app (verificado, não suspenso, não bloqueado, etc).
-- ============================================================

-- 1. PostGIS ----------------------------------------------------
create extension if not exists postgis;

-- 2. Colunas em profiles ----------------------------------------
alter table public.profiles
  add column if not exists geo_loc geography(Point, 4326),
  add column if not exists geo_atualizado_em timestamptz,
  add column if not exists geo_visivel boolean not null default true;

-- 3. Index GIST pra busca espacial rápida ----------------------
create index if not exists idx_profiles_geo_loc
  on public.profiles using gist (geo_loc)
  where geo_loc is not null and geo_visivel = true;

-- 4. RPC pra buscar perfis próximos ----------------------------
-- Recebe lat/lng do caller + raio em km + limite. Filtra:
--   - Verificados, não suspensos, não deletados
--   - Que não sejam o próprio caller
--   - geo_visivel = true e geo_loc not null
--   - Não bloqueados (em ambas direções)
--   - Dentro do raio (ST_DWithin com geography aceita metros)
-- Retorna ordenado por distância crescente.
create or replace function public.radar_perfis_proximos(
  p_lat       double precision,
  p_lng       double precision,
  p_raio_km   double precision default 50,
  p_limit     int default 50
)
returns table (
  profile_id      uuid,
  nome_exibicao   text,
  handle          text,
  tipo            text,
  cidade          text,
  estado          text,
  idade_1         int,
  idade_2         int,
  verificado      boolean,
  vip_ate         timestamptz,
  distancia_m     double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_origem geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_raio_m double precision := p_raio_km * 1000;
begin
  if v_caller is null then
    return;
  end if;

  return query
  select
    p.id                                              as profile_id,
    p.nome_exibicao,
    p.handle,
    p.tipo::text                                      as tipo,
    p.cidade,
    p.estado,
    p.idade_1,
    p.idade_2,
    p.verificado,
    p.vip_ate,
    ST_Distance(p.geo_loc, v_origem)                  as distancia_m
  from public.profiles p
  where p.id <> v_caller
    and p.verificado = true
    and coalesce(p.suspenso, false) = false
    and p.deletado_em is null
    and p.geo_visivel = true
    and p.geo_loc is not null
    and ST_DWithin(p.geo_loc, v_origem, v_raio_m)
    and not exists (
      select 1 from public.bloqueios b
       where (b.de_id = v_caller and b.para_id = p.id)
          or (b.de_id = p.id and b.para_id = v_caller)
    )
  order by p.geo_loc <-> v_origem  -- KNN operator pra usar o índice GIST
  limit p_limit;
end;
$$;

-- 5. RPC pra gravar a geo do user (usado pelo client) ----------
-- supabase-js não consegue passar ST_MakePoint via update direto,
-- então centralizamos aqui. Caller passa o user_id (auth.uid no
-- client). RPC checa que o p_user_id bate com auth.uid.
create or replace function public.set_minha_geo(
  p_user_id uuid,
  p_lat     double precision,
  p_lng     double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'forbidden';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coords';
  end if;

  update public.profiles
     set geo_loc = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
         geo_atualizado_em = now()
   where id = p_user_id;
end;
$$;

-- 6. Permissões de execução -------------------------------------
grant execute on function public.radar_perfis_proximos(
  double precision, double precision, double precision, int
) to authenticated;
grant execute on function public.set_minha_geo(
  uuid, double precision, double precision
) to authenticated;
