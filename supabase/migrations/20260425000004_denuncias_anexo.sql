-- ============================================================
-- PrivateSocial — Denúncias com anexo (print de prova)
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Adiciona:
--  1. denuncias.anexo_url (text, nullable) — path do print no bucket
--  2. Bucket privado `denuncias-anexos` (signed URLs via admin client)
--  3. RLS: user faz upload no próprio path; nenhum SELECT pra
--     authenticated (admin lê via service role)
-- ============================================================

alter table public.denuncias
  add column if not exists anexo_url text;

-- Bucket privado (não tem flag SQL pra "private", basta public=false)
insert into storage.buckets (id, name, public)
values ('denuncias-anexos', 'denuncias-anexos', false)
on conflict (id) do nothing;

-- INSERT no bucket: user só pode upload no path que começa com seu uid.
-- Sem policy de SELECT pra authenticated — admin lê via service_role.
drop policy if exists "denuncias_anexos_insert_self"
  on storage.objects;
create policy "denuncias_anexos_insert_self"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'denuncias-anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: user pode apagar próprio anexo (caso desista da denúncia)
drop policy if exists "denuncias_anexos_delete_self"
  on storage.objects;
create policy "denuncias_anexos_delete_self"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'denuncias-anexos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
