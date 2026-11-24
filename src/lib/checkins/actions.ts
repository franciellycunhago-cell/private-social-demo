"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DEFAULT_DURATION_HOURS = 12;

/* ====================================================================
 * Server Actions — checkin em eventos
 *
 *  - checkInEvento(eventoId, duracaoHoras?) : insere/atualiza checkin
 *  - checkOutEvento(eventoId)               : remove
 * ================================================================== */

export async function checkInEvento(
  eventoId: string,
  duracaoHoras = DEFAULT_DURATION_HOURS,
): Promise<{ ok: true; expiresAt: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const expiresAt = new Date(
    Date.now() + duracaoHoras * 60 * 60 * 1000,
  ).toISOString();

  const admin = adminClient();
  const { error } = await admin.from("checkins").upsert(
    { profile_id: user.id, evento_id: eventoId, expires_at: expiresAt },
    { onConflict: "profile_id,evento_id" },
  );

  if (error) return { error: error.message };
  revalidatePath(`/app/eventos/${eventoId}`);
  revalidatePath("/app/eventos");
  return { ok: true, expiresAt };
}

export async function checkOutEvento(
  eventoId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  const { error } = await admin
    .from("checkins")
    .delete()
    .eq("profile_id", user.id)
    .eq("evento_id", eventoId);

  if (error) return { error: error.message };
  revalidatePath(`/app/eventos/${eventoId}`);
  revalidatePath("/app/eventos");
  return { ok: true };
}
