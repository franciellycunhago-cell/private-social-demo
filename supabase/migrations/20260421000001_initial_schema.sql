-- ============================================================
-- PrivateSocial — Schema inicial (Semana 1)
-- ============================================================
-- Rode este arquivo no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Este arquivo cria:
--  1. Tabelas core (profiles, verificacoes, fotos, pedidos_privado,
--     curtidas, matches, conversas, mensagens, eventos,
--     confirmacoes_evento, assinaturas, denuncias, eventos_app)
--  2. Triggers (auto-create profile no signup, updated_at, match
--     automático no like mútuo)
--  3. RLS policies (row-level security em TODAS as tabelas)
--  4. Índices para performance
--
-- Referência: PROGRESSO.md §🗄️ Schema inicial do banco
-- ============================================================

-- Extensões -----------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================
create type profile_tipo   as enum ('casal', 'homem', 'mulher');
create type experiencia    as enum ('curioso', 'iniciante', 'experiente', 'veterano');

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  handle            text unique,                       -- @marina.rafael
  tipo              profile_tipo,
  nome_exibicao     text,
  idade_1           int check (idade_1 is null or idade_1 >= 18),
  idade_2           int check (idade_2 is null or idade_2 >= 18),
  cidade            text,
  estado            text,
  latitude          numeric,
  longitude         numeric,
  bio               text,
  experiencia       experiencia,
  verificado        boolean not null default false,
  trust_score       int not null default 0,
  svip_ate          timestamptz,                       -- null = free; data futura = SVIP ativo
  ultimo_ativo      timestamptz default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_profiles_cidade on public.profiles(cidade);
create index idx_profiles_verificado on public.profiles(verificado) where verificado = true;
create index idx_profiles_svip on public.profiles(svip_ate) where svip_ate is not null;

-- Auto-criar profile quando user cadastra via auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 2. VERIFICAÇÕES (selfie)
-- ============================================================
create type verificacao_status as enum ('pendente', 'aprovado', 'rejeitado');

create table public.verificacoes (
  id                uuid primary key default uuid_generate_v4(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  foto_url          text not null,                     -- só admin vê
  status            verificacao_status not null default 'pendente',
  motivo_rejeicao   text,
  revisado_por      uuid references public.profiles(id),
  revisado_em       timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_verificacoes_status on public.verificacoes(status);
create index idx_verificacoes_profile on public.verificacoes(profile_id);

-- ============================================================
-- 3. FOTOS (públicas e privadas)
-- ============================================================
create type foto_tipo as enum ('publica', 'privada');

create table public.fotos (
  id                uuid primary key default uuid_generate_v4(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  url               text not null,
  tipo              foto_tipo not null default 'publica',
  ordem             int not null default 0,
  created_at        timestamptz not null default now()
);

create index idx_fotos_profile on public.fotos(profile_id, ordem);

-- ============================================================
-- 4. PEDIDOS DE ACESSO A FOTOS PRIVADAS
-- ============================================================
create type pedido_status as enum ('pendente', 'aprovado', 'negado');

create table public.pedidos_privado (
  id                uuid primary key default uuid_generate_v4(),
  solicitante_id    uuid not null references public.profiles(id) on delete cascade,
  alvo_id           uuid not null references public.profiles(id) on delete cascade,
  status            pedido_status not null default 'pendente',
  created_at        timestamptz not null default now(),
  unique (solicitante_id, alvo_id)
);

-- ============================================================
-- 5. CURTIDAS + MATCHES
-- ============================================================
create type curtida_tipo as enum ('like', 'super');

create table public.curtidas (
  id                uuid primary key default uuid_generate_v4(),
  de_id             uuid not null references public.profiles(id) on delete cascade,
  para_id           uuid not null references public.profiles(id) on delete cascade,
  tipo              curtida_tipo not null default 'like',
  created_at        timestamptz not null default now(),
  unique (de_id, para_id),
  check (de_id <> para_id)
);

create index idx_curtidas_para on public.curtidas(para_id);

create table public.matches (
  id                uuid primary key default uuid_generate_v4(),
  profile_1         uuid not null references public.profiles(id) on delete cascade,
  profile_2         uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  -- Garante par canônico (menor id primeiro)
  constraint matches_canonical check (profile_1 < profile_2),
  unique (profile_1, profile_2)
);

create index idx_matches_p1 on public.matches(profile_1);
create index idx_matches_p2 on public.matches(profile_2);

-- Match automático: quando uma curtida é mútua, cria match
create or replace function public.check_mutual_like()
returns trigger language plpgsql as $$
declare
  p1 uuid;
  p2 uuid;
begin
  if exists (
    select 1 from public.curtidas
    where de_id = new.para_id and para_id = new.de_id
  ) then
    -- Ordena par canônico
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

create trigger curtidas_create_match
  after insert on public.curtidas
  for each row execute function public.check_mutual_like();

-- ============================================================
-- 6. CHAT (conversas + mensagens)
-- ============================================================
create type mensagem_tipo as enum ('texto', 'imagem', 'audio');

create table public.conversas (
  id                uuid primary key default uuid_generate_v4(),
  match_id          uuid not null unique references public.matches(id) on delete cascade,
  ultima_mensagem_em timestamptz
);

create table public.mensagens (
  id                uuid primary key default uuid_generate_v4(),
  conversa_id       uuid not null references public.conversas(id) on delete cascade,
  de_id             uuid not null references public.profiles(id) on delete cascade,
  texto             text,
  tipo              mensagem_tipo not null default 'texto',
  anexo_url         text,
  lido              boolean not null default false,
  created_at        timestamptz not null default now()
);

create index idx_mensagens_conversa on public.mensagens(conversa_id, created_at desc);

-- ============================================================
-- 7. EVENTOS
-- ============================================================
create type evento_tipo as enum ('proprio', 'patrocinado');

create table public.eventos (
  id                  uuid primary key default uuid_generate_v4(),
  titulo              text not null,
  descricao           text,
  data                timestamptz not null,
  local               text,
  cidade              text,
  capacidade          int,
  dress_code          text,
  tipo                evento_tipo not null default 'proprio',
  patrocinador_nome   text,
  valor_patrocinio    numeric(10,2),
  foto_url            text,
  svip_only           boolean not null default false,
  publicado           boolean not null default false,
  created_at          timestamptz not null default now()
);

create index idx_eventos_data on public.eventos(data) where publicado = true;
create index idx_eventos_cidade on public.eventos(cidade) where publicado = true;

create table public.confirmacoes_evento (
  id                uuid primary key default uuid_generate_v4(),
  evento_id         uuid not null references public.eventos(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (evento_id, profile_id)
);

-- ============================================================
-- 8. ASSINATURAS (Asaas)
-- ============================================================
create type assinatura_status as enum ('ativa', 'cancelada', 'inadimplente');

create table public.assinaturas (
  id                      uuid primary key default uuid_generate_v4(),
  profile_id              uuid not null references public.profiles(id) on delete cascade,
  asaas_subscription_id   text unique,
  valor                   numeric(10,2) not null,
  status                  assinatura_status not null default 'ativa',
  inicio                  timestamptz not null default now(),
  fim                     timestamptz,
  cancelada_em            timestamptz,
  created_at              timestamptz not null default now()
);

create index idx_assinaturas_profile on public.assinaturas(profile_id);
create index idx_assinaturas_status on public.assinaturas(status);

-- ============================================================
-- 9. DENÚNCIAS
-- ============================================================
create type denuncia_status as enum ('aberta', 'em_analise', 'resolvida');

create table public.denuncias (
  id                uuid primary key default uuid_generate_v4(),
  denunciante_id    uuid not null references public.profiles(id) on delete cascade,
  denunciado_id     uuid not null references public.profiles(id) on delete cascade,
  motivo            text not null,
  descricao         text,
  status            denuncia_status not null default 'aberta',
  created_at        timestamptz not null default now()
);

create index idx_denuncias_status on public.denuncias(status);

-- ============================================================
-- 10. ANALYTICS (eventos do app)
-- ============================================================
create table public.eventos_app (
  id                uuid primary key default uuid_generate_v4(),
  profile_id        uuid references public.profiles(id) on delete set null,
  tipo              text not null,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);

create index idx_eventos_app_profile on public.eventos_app(profile_id, created_at desc);
create index idx_eventos_app_tipo on public.eventos_app(tipo, created_at desc);

-- ============================================================
-- 11. ADMINS (controle de quem é admin — dono do produto + você)
-- ============================================================
create table public.admins (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  nivel             text not null default 'moderador',  -- 'super' | 'moderador'
  created_at        timestamptz not null default now()
);

-- Helper function: verifica se o usuário autenticado é admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admins where profile_id = auth.uid()
  );
$$;

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.verificacoes       enable row level security;
alter table public.fotos              enable row level security;
alter table public.pedidos_privado    enable row level security;
alter table public.curtidas           enable row level security;
alter table public.matches            enable row level security;
alter table public.conversas          enable row level security;
alter table public.mensagens          enable row level security;
alter table public.eventos            enable row level security;
alter table public.confirmacoes_evento enable row level security;
alter table public.assinaturas        enable row level security;
alter table public.denuncias          enable row level security;
alter table public.eventos_app        enable row level security;
alter table public.admins             enable row level security;

-- ---- PROFILES ----
-- Qualquer user autenticado vê perfis verificados (para o feed Descobrir)
create policy "profiles_select_verificados"
  on public.profiles for select
  to authenticated
  using (verificado = true or id = auth.uid() or public.is_admin());

-- User edita só o próprio perfil
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin pode editar qualquer perfil (aprovar verificação, etc.)
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- VERIFICAÇÕES ----
-- User vê só as próprias
create policy "verificacoes_select_self"
  on public.verificacoes for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy "verificacoes_insert_self"
  on public.verificacoes for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Só admin atualiza (aprovar/rejeitar)
create policy "verificacoes_update_admin"
  on public.verificacoes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- FOTOS ----
-- Públicas: todo mundo autenticado vê
-- Privadas: só quem tem pedido aprovado
create policy "fotos_select"
  on public.fotos for select
  to authenticated
  using (
    tipo = 'publica'
    or profile_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.pedidos_privado
      where solicitante_id = auth.uid()
        and alvo_id = fotos.profile_id
        and status = 'aprovado'
    )
  );

create policy "fotos_insert_self"
  on public.fotos for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "fotos_delete_self"
  on public.fotos for delete
  to authenticated
  using (profile_id = auth.uid());

-- ---- PEDIDOS PRIVADO ----
create policy "pedidos_select_envolvido"
  on public.pedidos_privado for select
  to authenticated
  using (solicitante_id = auth.uid() or alvo_id = auth.uid());

create policy "pedidos_insert_self"
  on public.pedidos_privado for insert
  to authenticated
  with check (solicitante_id = auth.uid());

-- Alvo aprova/nega
create policy "pedidos_update_alvo"
  on public.pedidos_privado for update
  to authenticated
  using (alvo_id = auth.uid())
  with check (alvo_id = auth.uid());

-- ---- CURTIDAS ----
create policy "curtidas_select_envolvido"
  on public.curtidas for select
  to authenticated
  using (
    de_id = auth.uid()
    -- Ver quem curtiu você = só SVIP
    or (
      para_id = auth.uid()
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and svip_ate > now()
      )
    )
  );

create policy "curtidas_insert_self"
  on public.curtidas for insert
  to authenticated
  with check (de_id = auth.uid());

-- ---- MATCHES ----
create policy "matches_select_envolvido"
  on public.matches for select
  to authenticated
  using (profile_1 = auth.uid() or profile_2 = auth.uid());

-- ---- CONVERSAS ----
create policy "conversas_select_envolvido"
  on public.conversas for select
  to authenticated
  using (
    exists (
      select 1 from public.matches
      where matches.id = conversas.match_id
        and (matches.profile_1 = auth.uid() or matches.profile_2 = auth.uid())
    )
  );

-- ---- MENSAGENS ----
create policy "mensagens_select_envolvido"
  on public.mensagens for select
  to authenticated
  using (
    exists (
      select 1 from public.conversas c
      join public.matches m on m.id = c.match_id
      where c.id = mensagens.conversa_id
        and (m.profile_1 = auth.uid() or m.profile_2 = auth.uid())
    )
  );

create policy "mensagens_insert_envolvido"
  on public.mensagens for insert
  to authenticated
  with check (
    de_id = auth.uid()
    and exists (
      select 1 from public.conversas c
      join public.matches m on m.id = c.match_id
      where c.id = mensagens.conversa_id
        and (m.profile_1 = auth.uid() or m.profile_2 = auth.uid())
    )
  );

-- ---- EVENTOS ----
create policy "eventos_select_publicado"
  on public.eventos for select
  to authenticated
  using (publicado = true or public.is_admin());

create policy "eventos_admin_all"
  on public.eventos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- CONFIRMAÇÕES ----
create policy "confirmacoes_select_self_or_admin"
  on public.confirmacoes_evento for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy "confirmacoes_insert_self"
  on public.confirmacoes_evento for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "confirmacoes_delete_self"
  on public.confirmacoes_evento for delete
  to authenticated
  using (profile_id = auth.uid());

-- ---- ASSINATURAS ----
create policy "assinaturas_select_self_or_admin"
  on public.assinaturas for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- INSERT/UPDATE via service_role (webhook Asaas) — bloqueado aqui

-- ---- DENÚNCIAS ----
create policy "denuncias_insert_self"
  on public.denuncias for insert
  to authenticated
  with check (denunciante_id = auth.uid());

create policy "denuncias_select_admin"
  on public.denuncias for select
  to authenticated
  using (denunciante_id = auth.uid() or public.is_admin());

-- ---- EVENTOS_APP (analytics) ----
create policy "eventos_app_insert_self"
  on public.eventos_app for insert
  to authenticated
  with check (profile_id = auth.uid() or profile_id is null);

create policy "eventos_app_select_admin"
  on public.eventos_app for select
  to authenticated
  using (public.is_admin());

-- ---- ADMINS ----
create policy "admins_select_admin"
  on public.admins for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- 13. STORAGE BUCKETS
-- ============================================================
-- Criar buckets (roda no Supabase Dashboard > Storage ou via SQL abaixo)
insert into storage.buckets (id, name, public) values
  ('fotos-publicas',   'fotos-publicas',   true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values
  ('fotos-privadas',   'fotos-privadas',   false),
  ('verificacoes',     'verificacoes',     false)
  on conflict (id) do nothing;

-- Storage policies
-- Fotos públicas: todos autenticados leem, user faz upload no próprio path
create policy "fotos_pub_select_auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos-publicas');

create policy "fotos_pub_insert_self"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos-publicas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos_pub_delete_self"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos-publicas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Fotos privadas: só dono vê/edita (pedidos são checados na tabela fotos)
create policy "fotos_priv_all_self"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'fotos-privadas'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fotos-privadas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verificações: user faz upload, só admin lê
create policy "verif_insert_self"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verificacoes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verif_select_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verificacoes'
    and public.is_admin()
  );
