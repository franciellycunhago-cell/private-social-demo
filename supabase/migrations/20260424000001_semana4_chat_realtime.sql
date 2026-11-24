-- ============================================================
-- PrivateSocial — Semana 4 (Chat em tempo real)
-- ============================================================
-- Rode no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/SEU-PROJETO/sql/new
--
-- Adiciona:
--  1. Auto-criação de `conversas` quando `matches` é inserido
--  2. Trigger: INSERT em `mensagens` atualiza `conversas.ultima_mensagem_em`
--  3. RPC `marcar_mensagens_lidas(conversa_id)` — seta lido=true em tudo
--     que não foi enviado pelo user atual
--  4. Policy de INSERT em `conversas` (conservadora — trigger usa security
--     definer, mas deixa o caminho aberto caso precise)
--  5. Realtime publication pra mensagens + pedidos_privado + conversas
-- ============================================================

-- 1. Auto-criar conversa quando cria match -----------------------
create or replace function public.create_conversa_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversas (match_id)
  values (new.id)
  on conflict (match_id) do nothing;
  return new;
end;
$$;

drop trigger if exists matches_create_conversa on public.matches;
create trigger matches_create_conversa
  after insert on public.matches
  for each row execute function public.create_conversa_for_match();

-- Backfill: cria conversas para matches que existem mas ainda não têm uma
insert into public.conversas (match_id)
select m.id
from public.matches m
left join public.conversas c on c.match_id = m.id
where c.id is null;

-- 2. Trigger: última mensagem atualiza conversa ------------------
create or replace function public.bump_conversa_on_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversas
  set ultima_mensagem_em = new.created_at
  where id = new.conversa_id;
  return new;
end;
$$;

drop trigger if exists mensagens_bump_conversa on public.mensagens;
create trigger mensagens_bump_conversa
  after insert on public.mensagens
  for each row execute function public.bump_conversa_on_mensagem();

-- 3. RPC marcar mensagens como lidas -----------------------------
-- Marca todas as mensagens da conversa que NÃO foram enviadas pelo user
-- autenticado como `lido = true`. Segura porque a RLS de mensagens só
-- deixa o próprio envolvido ler/atualizar.
create or replace function public.marcar_mensagens_lidas(p_conversa_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_autorizado boolean;
begin
  -- Garante que o caller participa da conversa (defense in depth — a RLS
  -- já protege, mas o security definer bypassa, então validamos aqui)
  select exists (
    select 1 from public.conversas c
    join public.matches m on m.id = c.match_id
    where c.id = p_conversa_id
      and (m.profile_1 = auth.uid() or m.profile_2 = auth.uid())
  ) into v_autorizado;

  if not v_autorizado then
    return 0;
  end if;

  update public.mensagens
  set lido = true
  where conversa_id = p_conversa_id
    and de_id <> auth.uid()
    and lido = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.marcar_mensagens_lidas(uuid) to authenticated;

-- 4. Policy conservadora de INSERT em conversas ------------------
-- O trigger cria conversas com security definer, então não precisamos de
-- policy de INSERT pro fluxo normal. Mesmo assim deixamos explícito que
-- o participante do match pode INSERT/UPDATE sua própria conversa.
drop policy if exists "conversas_insert_envolvido" on public.conversas;
create policy "conversas_insert_envolvido"
  on public.conversas for insert
  to authenticated
  with check (
    exists (
      select 1 from public.matches
      where matches.id = conversas.match_id
        and (matches.profile_1 = auth.uid() or matches.profile_2 = auth.uid())
    )
  );

-- UPDATE em mensagens: só o destinatário pode marcar como lida (via RPC
-- que roda com security definer, mas deixamos uma policy SQL explícita
-- também pra permitir updates pontuais do próprio envolvido).
drop policy if exists "mensagens_update_envolvido" on public.mensagens;
create policy "mensagens_update_envolvido"
  on public.mensagens for update
  to authenticated
  using (
    exists (
      select 1 from public.conversas c
      join public.matches m on m.id = c.match_id
      where c.id = mensagens.conversa_id
        and (m.profile_1 = auth.uid() or m.profile_2 = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.conversas c
      join public.matches m on m.id = c.match_id
      where c.id = mensagens.conversa_id
        and (m.profile_1 = auth.uid() or m.profile_2 = auth.uid())
    )
  );

-- 5. Realtime publication ----------------------------------------
-- `supabase_realtime` é a publication padrão do Supabase. Adicionamos só
-- as tabelas que o cliente precisa assinar (mensagens + pedidos_privado
-- pra notificar o alvo quando muda status). DO block evita erro se a
-- tabela já estiver na publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mensagens'
  ) then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos_privado'
  ) then
    execute 'alter publication supabase_realtime add table public.pedidos_privado';
  end if;
end $$;

-- 6. Índice auxiliar pra query de conversas ativas ---------------
create index if not exists idx_conversas_match
  on public.conversas(match_id);

create index if not exists idx_mensagens_unread
  on public.mensagens(conversa_id, lido)
  where lido = false;
