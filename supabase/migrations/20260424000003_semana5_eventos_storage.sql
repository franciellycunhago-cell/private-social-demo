-- ============================================================
-- PrivateSocial — Semana 5 (Eventos — bucket e ajustes)
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- A tabela `eventos` já foi criada na Semana 1. Esta migration só:
--  1. Cria o bucket público `eventos` pra capa dos eventos
--  2. Policies de storage: admin escreve/apaga, todos leem
--  3. Política de UPDATE em `confirmacoes_evento` (opcional) — hoje o
--     fluxo é só INSERT/DELETE, mas se precisarmos marcar "confirmou
--     com acompanhante" depois, já fica pronto
-- ============================================================

-- 1. Bucket público ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do nothing;

-- 2. Storage policies -------------------------------------------
-- Leitura pública via getPublicUrl (já que bucket é public=true, o
-- select já funciona sem policy, mas vamos explicitar)
drop policy if exists "eventos_select_all" on storage.objects;
create policy "eventos_select_all"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'eventos');

-- Só admin faz upload / update / delete
drop policy if exists "eventos_insert_admin" on storage.objects;
create policy "eventos_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'eventos' and public.is_admin());

drop policy if exists "eventos_update_admin" on storage.objects;
create policy "eventos_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'eventos' and public.is_admin())
  with check (bucket_id = 'eventos' and public.is_admin());

drop policy if exists "eventos_delete_admin" on storage.objects;
create policy "eventos_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'eventos' and public.is_admin());

-- 3. Índice auxiliar pro banner rotativo + feed -----------------
-- Eventos publicados ordenados por data. Já existe um índice em
-- `idx_eventos_data` mas ele filtra por publicado=true inline. Reforça
-- pra garantir lookups rápidos mesmo em beta.
create index if not exists idx_eventos_proximos
  on public.eventos (data asc)
  where publicado = true;
