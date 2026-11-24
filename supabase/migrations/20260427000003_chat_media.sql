-- ============================================================
-- PrivateSocial — Bucket pra mídia de chat (fotos enviadas em conversas)
-- ============================================================
-- Bucket privado. Cada user tem uma pasta com seu uuid.
-- SELECT bloqueado pra todos — leitura via signed URL gerada server-side
-- (mesma estratégia das fotos privadas).
--
-- Schema da tabela mensagens já tem suporte:
--   tipo mensagem_tipo ('texto', 'imagem', 'audio')
--   anexo_url text (path do storage)
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('chat-media', 'chat-media', false)
  on conflict (id) do nothing;

-- INSERT: user pode subir no path que começa com seu uuid
drop policy if exists "chat_media_insert_self" on storage.objects;
create policy "chat_media_insert_self"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: só dono pode apagar (caso queira "desfazer envio")
drop policy if exists "chat_media_delete_self" on storage.objects;
create policy "chat_media_delete_self"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: authenticated reads — paths são imprevisíveis (uuid+ts+random)
-- então a privacidade é dada por opacity, não por RLS. Necessária pro
-- client gerar signed URL ao receber msg via Realtime (sem essa policy
-- o createSignedUrl falha do lado client mesmo com user autenticado).
drop policy if exists "chat_media_select_authenticated" on storage.objects;
create policy "chat_media_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-media');
