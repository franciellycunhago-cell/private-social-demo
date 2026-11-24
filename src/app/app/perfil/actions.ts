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

/* ====================================================================
 * Server Actions /app/perfil
 *
 *  - excluirMinhaConta() : soft delete da própria conta (LGPD).
 *    Marca profiles.deletado_em = now(); página /excluido mostra
 *    período de carência de 7 dias antes do hard delete (que vai
 *    ser feito por cron). Pode ser revertido pelo admin nesse prazo.
 * ================================================================== */

export async function excluirMinhaConta(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/perfil");
  return { ok: true };
}
