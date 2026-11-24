import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type ActiveCheckin = { id: string; titulo: string };

/* ====================================================================
 * loadActiveCheckinsForProfiles — pra cada profile_id passado, retorna
 * o evento mais recente em que tem checkin ativo (expires_at > now).
 *
 * Faz 2 queries: checkins em batch + eventos em batch. Retorna map
 * profile_id → { id, titulo }.
 * ================================================================== */

export async function loadActiveCheckinsForProfiles(
  profileIds: string[],
): Promise<Map<string, ActiveCheckin>> {
  if (profileIds.length === 0) return new Map();
  const admin = adminClient();

  const { data: checkins } = await admin
    .from("checkins")
    .select("profile_id, evento_id, expires_at")
    .in("profile_id", profileIds)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });

  const rows = (checkins ?? []) as {
    profile_id: string;
    evento_id: string;
    expires_at: string;
  }[];
  if (rows.length === 0) return new Map();

  // Pega só o checkin mais recente por perfil
  const byProfile = new Map<string, string>(); // profile_id → evento_id
  for (const r of rows) {
    if (!byProfile.has(r.profile_id)) byProfile.set(r.profile_id, r.evento_id);
  }

  const eventoIds = Array.from(new Set(byProfile.values()));
  const { data: eventos } = await admin
    .from("eventos")
    .select("id, titulo")
    .in("id", eventoIds);

  const eventosMap = new Map<string, string>();
  (eventos ?? []).forEach((e) =>
    eventosMap.set(e.id as string, e.titulo as string),
  );

  const out = new Map<string, ActiveCheckin>();
  byProfile.forEach((evId, pid) => {
    const titulo = eventosMap.get(evId);
    if (titulo) out.set(pid, { id: evId, titulo });
  });
  return out;
}
