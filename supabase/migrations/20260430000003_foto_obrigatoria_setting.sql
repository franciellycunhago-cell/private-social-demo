-- ============================================================
-- PrivateSocial — Feature flag foto_obrigatoria
-- ============================================================
-- Quando true, user precisa ter pelo menos 1 foto pública na galeria
-- pra poder usar /app. Se entrar sem foto, é redirecionado pra
-- /primeira-foto que só libera o app depois do primeiro upload.
-- Default true — decisão de produto pra evitar perfis fake/espião.
-- Admin pode desligar pelo /admin/configuracoes se for muito radical.
-- ============================================================

insert into public.app_settings (key, value)
values ('foto_obrigatoria', 'true'::jsonb)
on conflict (key) do nothing;
