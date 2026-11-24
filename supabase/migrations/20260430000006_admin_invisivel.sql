-- ============================================================
-- PrivateSocial — Admin invisível em interações públicas
-- ============================================================
-- Decisão de produto 30/04: admins NÃO devem aparecer em listas
-- "quem curtiu" / "quem visitou" pra users comuns. Modo de
-- moderação stealth.
--
-- Já estava implementado pra: visitas de perfil (perfil_views,
-- via lib/perfil-views/actions.ts).
--
-- Esta migration estende pra: curtidas em fotos, curtidas em
-- posts e curtidas de perfil. Adiciona coluna `oculta boolean`
-- nas tabelas, faz backfill marcando curtidas de admins
-- existentes, atualiza triggers de counter pra ignorar `oculta=true`,
-- e atualiza o trigger de match mútuo pra também ignorar.
--
-- Comentários NÃO são afetados — admin comenta normalmente
-- (decisão produto: comentário é interação social legítima).
-- ============================================================

-- 1. Coluna `oculta` nas 3 tabelas ------------------------------
alter table public.curtidas_foto
  add column if not exists oculta boolean not null default false;

alter table public.posts_likes
  add column if not exists oculta boolean not null default false;

alter table public.curtidas
  add column if not exists oculta boolean not null default false;

-- 2. Backfill: marca curtidas de admins atuais como oculta=true
update public.curtidas_foto
   set oculta = true
 where profile_id in (select profile_id from public.admins)
   and oculta = false;

update public.posts_likes
   set oculta = true
 where profile_id in (select profile_id from public.admins)
   and oculta = false;

update public.curtidas
   set oculta = true
 where de_id in (select profile_id from public.admins)
   and oculta = false;

-- 3. Atualiza trigger curtidas_foto_counter pra ignorar oculta=true
-- (mantém SECURITY DEFINER do fix 20260430000004)
create or replace function public.curtidas_foto_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.oculta = false then
      update public.fotos
         set likes_count = likes_count + 1
       where id = new.foto_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.oculta = false then
      update public.fotos
         set likes_count = greatest(0, likes_count - 1)
       where id = old.foto_id;
    end if;
    return old;
  end if;
  return null;
end $$;

-- 4. Atualiza trigger posts_likes_counter pra ignorar oculta=true
-- (precisa de SECURITY DEFINER — sem isso, user comum INSERT em
-- posts_likes não conseguiria UPDATE em posts.likes_count se posts
-- tivesse RLS restritiva. Mesmo padrão de defesa em profundidade.)
create or replace function public.posts_likes_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.oculta = false then
      update public.posts
         set likes_count = likes_count + 1
       where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.oculta = false then
      update public.posts
         set likes_count = greatest(0, likes_count - 1)
       where id = old.post_id;
    end if;
    return old;
  end if;
  return null;
end $$;

-- 5. Atualiza check_mutual_like pra ignorar curtidas oculta=true
-- (admin curte mas não cria match — admin usa openChatWith pra
-- iniciar conversa direto)
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
  -- Se a curtida nova é oculta (admin), não cria match
  if new.oculta = true then
    return new;
  end if;

  -- Procura curtida recíproca não-oculta
  if exists (
    select 1 from public.curtidas
    where de_id = new.para_id
      and para_id = new.de_id
      and oculta = false
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

-- 6. Recalcula counters de fotos.likes_count e posts.likes_count
-- (idempotente — exclui agora as curtidas oculta=true)
update public.fotos f
   set likes_count = coalesce((
     select count(*)::int
       from public.curtidas_foto cf
      where cf.foto_id = f.id
        and cf.oculta = false
   ), 0);

update public.posts p
   set likes_count = coalesce((
     select count(*)::int
       from public.posts_likes pl
      where pl.post_id = p.id
        and pl.oculta = false
   ), 0);
