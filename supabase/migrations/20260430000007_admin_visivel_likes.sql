-- ============================================================
-- PrivateSocial — Reverte invisibilidade do admin pra curtidas
-- ============================================================
-- Decisão de produto 30/04 (revisada): o admin DEVE aparecer em
-- curtidas pra interagir com os perfis (o administrador quer que seus
-- conhecidos sintam-se vistos). Mantém invisível só pra visitas
-- de perfil (perfil_views).
--
-- Esta migration:
--  1. Marca todas as curtidas oculta=false (admin volta a aparecer)
--  2. Reverte triggers pra não checar oculta (counter inclui admin,
--     check_mutual_like cria match com admin)
--  3. Recalcula counters incluindo todas as curtidas
--
-- Coluna `oculta` fica no schema mas sem uso ativo — pode virar
-- deprecada futuramente ou ser reaproveitada. Manter idempotente.
-- ============================================================

-- 0. Garante que a coluna `oculta` existe nas 3 tabelas. Se a
-- migration 20260430000006 nunca foi rodada, a coluna não existe
-- e os UPDATE abaixo dão "column does not exist". Esta migration
-- precisa ser idempotente — funciona com ou sem o passo anterior.
alter table public.curtidas_foto
  add column if not exists oculta boolean not null default false;
alter table public.posts_likes
  add column if not exists oculta boolean not null default false;
alter table public.curtidas
  add column if not exists oculta boolean not null default false;

-- 1. Mostra todas as curtidas (admin volta a aparecer) ----------
update public.curtidas_foto set oculta = false where oculta = true;
update public.posts_likes set oculta = false where oculta = true;
update public.curtidas set oculta = false where oculta = true;

-- 2. Reverte trigger curtidas_foto_counter (mantém SECURITY DEFINER)
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

-- 3. Reverte trigger posts_likes_counter (mantém SECURITY DEFINER)
create or replace function public.posts_likes_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
       set likes_count = likes_count + 1
     where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
       set likes_count = greatest(0, likes_count - 1)
     where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

-- 4. Reverte check_mutual_like pra dispositar match normalmente
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
    where de_id = new.para_id
      and para_id = new.de_id
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

-- 5. Recalcula counters incluindo todas as curtidas ------------
update public.fotos f
   set likes_count = coalesce((
     select count(*)::int
       from public.curtidas_foto cf
      where cf.foto_id = f.id
   ), 0);

update public.posts p
   set likes_count = coalesce((
     select count(*)::int
       from public.posts_likes pl
      where pl.post_id = p.id
   ), 0);
