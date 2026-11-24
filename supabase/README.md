# Supabase — PrivateSocial

## Como rodar as migrations

### Opção 1: Dashboard (recomendado pra MVP)
1. Abrir [SQL Editor do Supabase](https://supabase.com/dashboard/project/SEU-PROJETO/sql/new)
2. Rodar as migrations em ordem (cada arquivo de `migrations/` copiado e colado):
   - `20260421000001_initial_schema.sql` — schema inicial (14 tabelas + RLS + buckets)
   - `20260423000001_semana3_profile_enrichment.sql` — adiciona `intencoes` e `limites` em profiles + helper `mark_active()`
3. Confirmar que não houve erros (deveria ver "Success. No rows returned")

### Opção 2: Supabase CLI (pra quando evoluir)
```bash
# Instalar CLI
npm install -g supabase

# Linkar projeto
supabase link --project-ref SEU-PROJETO

# Aplicar migrations
supabase db push
```

## Como adicionar um admin (Admin + você)

Depois que o Admin (ou você) criar conta pelo app, rode no SQL Editor:

```sql
insert into public.admins (profile_id, nivel)
values ('<uuid-do-user>', 'super');
```

Pra pegar o UUID: `select id, email from auth.users;`

## Como testar RLS

No SQL Editor, com um user autenticado:
```sql
-- Deve retornar só perfis verificados + o próprio
select * from public.profiles;

-- Deve falhar (policy não permite)
update public.profiles set verificado = true where id = '<outro-user>';
```
