-- ============================================================
-- PrivateSocial — Semana 3 (Perfil + Descobrir)
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. profiles.intencoes text[]  (intenções: Swing, Amizade, etc.)
--  2. profiles.limites   text[]  (limites/preferências)
--  3. Hidrata intenções/limites dos eventos_app existentes
--  4. RLS: quem tem match pode ver o perfil do outro mesmo sem verificação própria
--  5. Helper `mark_active()` pra atualizar ultimo_ativo do user logado
-- ============================================================

-- 1. Colunas --------------------------------------------------
alter table public.profiles
  add column if not exists intencoes text[] not null default '{}',
  add column if not exists limites   text[] not null default '{}';

-- 2. Hidratar dados antigos do eventos_app --------------------
-- Users que fizeram onboarding antes da Semana 3 gravaram intenções/limites
-- como metadata em eventos_app (tipo='onboarding_completed'). Puxa pra cá.
update public.profiles p
set intencoes = coalesce(
      (
        select array_agg(distinct x::text)
        from jsonb_array_elements_text(e.metadata->'intencoes') as x
      ),
      p.intencoes
    ),
    limites = coalesce(
      (
        select array_agg(distinct x::text)
        from jsonb_array_elements_text(e.metadata->'limites') as x
      ),
      p.limites
    )
from (
  select distinct on (profile_id)
    profile_id, metadata
  from public.eventos_app
  where tipo = 'onboarding_completed'
    and metadata is not null
  order by profile_id, created_at desc
) as e
where p.id = e.profile_id
  and (
    (p.intencoes = '{}' and e.metadata ? 'intencoes')
    or (p.limites = '{}' and e.metadata ? 'limites')
  );

-- 3. Políticas extras -----------------------------------------
-- Quem tem match com você pode ler seu perfil mesmo se ainda não
-- estiver verificado (edge-case raro, mas evita perfil "some" num match).
drop policy if exists "profiles_select_match" on public.profiles;
create policy "profiles_select_match"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where (m.profile_1 = auth.uid() and m.profile_2 = profiles.id)
         or (m.profile_2 = auth.uid() and m.profile_1 = profiles.id)
    )
  );

-- 4. Helper: marcar usuário como ativo ------------------------
-- Usado sempre que o user abre o app/descobre/chat. RLS bloqueia
-- update de outros campos pois usa policies existentes do próprio user.
create or replace function public.mark_active()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set ultimo_ativo = now()
  where id = auth.uid();
$$;

grant execute on function public.mark_active() to authenticated;

-- 5. Índice adicional pro feed Descobrir ----------------------
create index if not exists idx_profiles_descobrir
  on public.profiles (ultimo_ativo desc)
  where verificado = true;
