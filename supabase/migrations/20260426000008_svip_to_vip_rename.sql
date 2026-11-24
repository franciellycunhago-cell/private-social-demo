-- ============================================================
-- PrivateSocial — Renomear SVIP → VIP
-- ============================================================
-- Decisão de produto 26/04/26: padronizar nomenclatura como VIP
-- (mais claro, padrão de mercado). SVIP era ambíguo.
--
-- Renomeia colunas, índices e atualiza policies/RPC que referenciam.
-- PostgreSQL atualiza policies automaticamente quando coluna é
-- renomeada via ALTER TABLE RENAME, mas como a RPC `admin_buscar_token`
-- tem o nome da coluna no return type, precisa de DROP+CREATE.
-- ============================================================

-- 1. profiles.svip_ate → profiles.vip_ate
alter table public.profiles
  rename column svip_ate to vip_ate;

-- 2. eventos.svip_only → eventos.vip_only
alter table public.eventos
  rename column svip_only to vip_only;

-- 3. Renomear índice
alter index if exists idx_profiles_svip rename to idx_profiles_vip;

-- 4. Recriar RPC admin_buscar_token com novo return type
drop function if exists public.admin_buscar_token(text);

create or replace function public.admin_buscar_token(p_prefix text)
returns table (
  id              uuid,
  nome_exibicao   text,
  handle          text,
  cidade          text,
  estado          text,
  verificado      boolean,
  vip_ate         timestamptz,
  ultimo_ativo    timestamptz,
  trust_score     int
)
language sql
security definer
set search_path = public
as $$
  select id, nome_exibicao, handle, cidade, estado,
         verificado, vip_ate, ultimo_ativo, trust_score
  from public.profiles
  where upper(replace(id::text, '-', '')) like upper(p_prefix) || '%'
  limit 20;
$$;

revoke all on function public.admin_buscar_token(text) from public;
grant execute on function public.admin_buscar_token(text) to service_role;

-- 5. Recriar policy "Ver quem curtiu você" (PostgreSQL atualiza
-- a referência ao renomear coluna, mas re-criamos por segurança)
drop policy if exists "curtidas_select_envolvido" on public.curtidas;

create policy "curtidas_select_envolvido"
  on public.curtidas for select
  to authenticated
  using (
    de_id = auth.uid()
    -- Ver quem curtiu você = só VIP
    or (
      para_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and vip_ate > now()
      )
    )
  );
