-- ============================================================
-- PrivateSocial — Sistema de convites
-- ============================================================
-- Rode no SQL Editor do Supabase.
--
-- Cada perfil verificado pode gerar até 5 códigos ativos por mês
-- pra convidar amigos. Código válido por 30 dias. Quem entrar
-- com código fica vinculado ao convidante (admin pode usar pra
-- ver "rede" de quem trouxe quem).
-- ============================================================

create table if not exists public.convites (
  id              uuid primary key default uuid_generate_v4(),
  codigo          text not null unique,
  convidante_id   uuid not null references public.profiles(id) on delete cascade,
  convidado_id    uuid references public.profiles(id) on delete set null,
  usado_em        timestamptz,
  expira_em       timestamptz not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_convites_convidante
  on public.convites(convidante_id, created_at desc);

create index if not exists idx_convites_codigo
  on public.convites(codigo) where usado_em is null;

create index if not exists idx_convites_convidado
  on public.convites(convidado_id) where convidado_id is not null;

-- RLS
alter table public.convites enable row level security;

-- SELECT: convidante vê os próprios convites
drop policy if exists "convites_select_convidante" on public.convites;
create policy "convites_select_convidante"
  on public.convites for select to authenticated
  using (convidante_id = auth.uid() or public.is_admin());

-- INSERT: user verificado cria os próprios (limite enforced via app)
drop policy if exists "convites_insert_self" on public.convites;
create policy "convites_insert_self"
  on public.convites for insert to authenticated
  with check (
    convidante_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and verificado = true
    )
  );

-- DELETE: convidante pode cancelar próprio convite não-usado
drop policy if exists "convites_delete_self" on public.convites;
create policy "convites_delete_self"
  on public.convites for delete to authenticated
  using (convidante_id = auth.uid() and usado_em is null);

-- UPDATE só via admin client (consumir convite ao cadastrar) — sem policy.
