-- ============================================================
-- PrivateSocial — Comentários + curtidas em fotos
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. comentarios_foto (id, foto_id, profile_id, texto, created_at)
--     - Texto: máx 280 chars. Sem thread / reply pra não virar WhatsApp
--  2. comentarios_foto_likes (comentario_id, profile_id)
--  3. RLS:
--     - Leitura: mesma regra da foto (publica=todos | privada=dono ou
--       quem tem pedido aprovado)
--     - Insert: só user autenticado na própria linha
--     - Delete: só autor do comentário OU dono da foto (moderar)
-- ============================================================

-- 1. Tabelas ----------------------------------------------------
create table if not exists public.comentarios_foto (
  id           uuid primary key default uuid_generate_v4(),
  foto_id      uuid not null references public.fotos(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  texto        text not null check (char_length(texto) between 1 and 280),
  created_at   timestamptz not null default now()
);

create index if not exists idx_comentarios_foto_foto
  on public.comentarios_foto(foto_id, created_at desc);

create index if not exists idx_comentarios_foto_profile
  on public.comentarios_foto(profile_id);

create table if not exists public.comentarios_foto_likes (
  comentario_id  uuid not null references public.comentarios_foto(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (comentario_id, profile_id)
);

create index if not exists idx_comentarios_foto_likes_comentario
  on public.comentarios_foto_likes(comentario_id);

-- 2. RLS --------------------------------------------------------
alter table public.comentarios_foto       enable row level security;
alter table public.comentarios_foto_likes enable row level security;

-- Leitura: mesma regra da foto em si (já tem RLS que filtra privadas
-- por pedido aprovado). Fazemos exists sobre `fotos`.
drop policy if exists "comentarios_foto_select" on public.comentarios_foto;
create policy "comentarios_foto_select"
  on public.comentarios_foto for select
  to authenticated
  using (
    exists (
      select 1 from public.fotos f
      where f.id = comentarios_foto.foto_id
        and (
          f.tipo = 'publica'
          or f.profile_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1 from public.pedidos_privado
            where solicitante_id = auth.uid()
              and alvo_id = f.profile_id
              and status = 'aprovado'
          )
        )
    )
  );

-- Insert: só user autenticado na própria linha, E precisa poder ver a
-- foto (evita comentar em privada que não tem acesso)
drop policy if exists "comentarios_foto_insert_envolvido" on public.comentarios_foto;
create policy "comentarios_foto_insert_envolvido"
  on public.comentarios_foto for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.fotos f
      where f.id = comentarios_foto.foto_id
        and (
          f.tipo = 'publica'
          or f.profile_id = auth.uid()
          or exists (
            select 1 from public.pedidos_privado
            where solicitante_id = auth.uid()
              and alvo_id = f.profile_id
              and status = 'aprovado'
          )
        )
    )
  );

-- Delete: autor do comentário OU dono da foto (moderar quem comentou)
drop policy if exists "comentarios_foto_delete_autor_ou_dono" on public.comentarios_foto;
create policy "comentarios_foto_delete_autor_ou_dono"
  on public.comentarios_foto for delete
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.fotos f
      where f.id = comentarios_foto.foto_id
        and f.profile_id = auth.uid()
    )
    or public.is_admin()
  );

-- Likes --------
-- SELECT: qualquer um que pode ver o comentário
drop policy if exists "comentarios_foto_likes_select" on public.comentarios_foto_likes;
create policy "comentarios_foto_likes_select"
  on public.comentarios_foto_likes for select
  to authenticated
  using (
    exists (
      select 1 from public.comentarios_foto c
      where c.id = comentarios_foto_likes.comentario_id
    )
  );

-- INSERT/DELETE: user curte/descurte no próprio nome
drop policy if exists "comentarios_foto_likes_insert_self" on public.comentarios_foto_likes;
create policy "comentarios_foto_likes_insert_self"
  on public.comentarios_foto_likes for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "comentarios_foto_likes_delete_self" on public.comentarios_foto_likes;
create policy "comentarios_foto_likes_delete_self"
  on public.comentarios_foto_likes for delete
  to authenticated
  using (profile_id = auth.uid());
