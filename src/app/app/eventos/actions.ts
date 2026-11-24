"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Server Actions /app/eventos
 *
 *  - confirmarPresenca(eventoId)
 *  - cancelarPresenca(eventoId)
 * ================================================================== */

export type PresencaResult = { ok: true } | { error: string };

export async function confirmarPresenca(
  eventoId: string,
): Promise<PresencaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { error } = await supabase
    .from("confirmacoes_evento")
    .insert({ evento_id: eventoId, profile_id: user.id });

  // 23505 = unique violation (já confirmado). Tratamos como sucesso.
  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  revalidatePath("/app/eventos");
  revalidatePath(`/app/eventos/${eventoId}`);
  return { ok: true };
}

export async function cancelarPresenca(
  eventoId: string,
): Promise<PresencaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { error } = await supabase
    .from("confirmacoes_evento")
    .delete()
    .eq("evento_id", eventoId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/eventos");
  revalidatePath(`/app/eventos/${eventoId}`);
  return { ok: true };
}
