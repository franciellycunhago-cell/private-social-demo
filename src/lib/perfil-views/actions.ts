"use server";

import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Tracking de visualização de perfil — feature VIP "quem viu seu perfil".
 *
 * Regras:
 *  - Não registra próprio user vendo o próprio perfil
 *  - Não registra admin (modo invisível pra moderação)
 *  - 1 par (visitante, perfil) único — visitas repetidas só atualizam
 *    ultima_visita
 *  - Fire-and-forget: erro não quebra a página
 * ================================================================== */

export async function registrarPerfilView(perfilId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (user.id === perfilId) return;

    // Admin é invisível — não registra suas visitas
    const { data: adminRow } = await supabase
      .from("admins")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (adminRow) return;

    await supabase.from("perfil_views").upsert(
      {
        visitante_id: user.id,
        perfil_id: perfilId,
        ultima_visita: new Date().toISOString(),
      },
      { onConflict: "visitante_id,perfil_id" },
    );
  } catch {
    // Silencioso — tracking não pode quebrar UX
  }
}
