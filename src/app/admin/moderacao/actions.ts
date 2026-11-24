"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Admin actions — aprovar/rejeitar verificação
 *
 * Em ambas as actions fazemos a checagem de admin explicitamente
 * (belt-and-suspenders com as RLS policies). Efeito:
 *
 *   approveVerification(id):
 *     - UPDATE verificacoes SET status='aprovado', revisado_por, revisado_em
 *     - UPDATE profiles SET verificado = true, trust_score = 50
 *     - INSERT analytics
 *
 *   rejectVerification(id, motivo):
 *     - UPDATE verificacoes SET status='rejeitado', motivo_rejeicao, …
 *
 * ================================================================== */

async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: admin } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!admin) throw new Error("Ação restrita a administradores.");
  return { supabase, userId: user.id };
}

export type ModerationActionState = {
  error?: string;
  ok?: true;
} | null;

export async function approveVerification(
  _prev: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  try {
    const id = (formData.get("id") ?? "").toString();
    if (!id) return { error: "Verificação inválida." };

    const { supabase, userId } = await ensureAdmin();

    const { data: verif, error: readErr } = await supabase
      .from("verificacoes")
      .select("id, profile_id, status")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { error: readErr.message };
    if (!verif) return { error: "Verificação não encontrada." };
    if (verif.status !== "pendente") {
      return { error: "Esta verificação já foi revisada." };
    }

    const { error: updVerifErr } = await supabase
      .from("verificacoes")
      .update({
        status: "aprovado",
        revisado_por: userId,
        revisado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      })
      .eq("id", id);
    if (updVerifErr) return { error: updVerifErr.message };

    const { error: updProfileErr } = await supabase
      .from("profiles")
      .update({ verificado: true, trust_score: 50 })
      .eq("id", verif.profile_id);
    if (updProfileErr) return { error: updProfileErr.message };

    await supabase.from("eventos_app").insert({
      profile_id: verif.profile_id,
      tipo: "verification_approved",
      metadata: { revisado_por: userId },
    });

    revalidatePath("/admin/moderacao");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export async function rejectVerification(
  _prev: ModerationActionState,
  formData: FormData,
): Promise<ModerationActionState> {
  try {
    const id = (formData.get("id") ?? "").toString();
    const motivo = (formData.get("motivo") ?? "").toString().trim();
    if (!id) return { error: "Verificação inválida." };
    if (!motivo) return { error: "Diga por que está rejeitando." };

    const { supabase, userId } = await ensureAdmin();

    const { data: verif } = await supabase
      .from("verificacoes")
      .select("id, profile_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!verif) return { error: "Verificação não encontrada." };
    if (verif.status !== "pendente") {
      return { error: "Esta verificação já foi revisada." };
    }

    const { error: updErr } = await supabase
      .from("verificacoes")
      .update({
        status: "rejeitado",
        motivo_rejeicao: motivo,
        revisado_por: userId,
        revisado_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (updErr) return { error: updErr.message };

    await supabase.from("eventos_app").insert({
      profile_id: verif.profile_id,
      tipo: "verification_rejected",
      metadata: { revisado_por: userId, motivo },
    });

    revalidatePath("/admin/moderacao");
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

