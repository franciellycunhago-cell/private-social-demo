import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * loadBlockedSet — retorna conjunto de profile IDs envolvidos em
 * bloqueio com o user (de qualquer direção). Usado pra filtrar feed,
 * stories, curtidas, conversas.
 * ================================================================== */
export async function loadBlockedSet(meId: string): Promise<Set<string>> {
  const admin = adminClient();
  const { data } = await admin
    .from("bloqueios")
    .select("de_id, para_id")
    .or(`de_id.eq.${meId},para_id.eq.${meId}`);

  const set = new Set<string>();
  (data ?? []).forEach((row) => {
    const outro = row.de_id === meId ? row.para_id : row.de_id;
    if (typeof outro === "string") set.add(outro);
  });
  return set;
}

/* ====================================================================
 * isBloqueadoPorMim — checa se o user me bloqueou ou eu bloqueei ele.
 * Útil em pages individuais (/app/p/[id]) pra decidir bloqueio.
 * Retorna 'eu_bloqueei', 'fui_bloqueado' ou null.
 * ================================================================== */
export async function checkBloqueio(
  meId: string,
  outroId: string,
): Promise<"eu_bloqueei" | "fui_bloqueado" | null> {
  const admin = adminClient();
  const { data } = await admin
    .from("bloqueios")
    .select("de_id, para_id")
    .or(
      `and(de_id.eq.${meId},para_id.eq.${outroId}),and(de_id.eq.${outroId},para_id.eq.${meId})`,
    )
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data.de_id === meId ? "eu_bloqueei" : "fui_bloqueado";
}
