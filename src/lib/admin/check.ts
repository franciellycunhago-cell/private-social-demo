/* ====================================================================
 * Helper: checa se um profile_id está na tabela admins.
 *
 * Aceita qualquer SupabaseClient já criado (server-scoped, admin/service
 * role, ou client-scoped) — só precisa permitir SELECT em `admins`.
 * RLS de admins permite leitura pelo próprio admin e pelo service role.
 *
 * Uso típico em server actions:
 *   const supabase = await createClient();
 *   const eAdmin = await isAdmin(supabase, user.id);
 * ================================================================== */

// Tipo mínimo — só precisamos do método .from().select().eq().maybeSingle()
type ClientLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: unknown }>;
      };
    };
  };
};

export async function isAdmin(
  client: unknown,
  profileId: string,
): Promise<boolean> {
  const c = client as ClientLike;
  const { data } = await c
    .from("admins")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return !!data;
}
