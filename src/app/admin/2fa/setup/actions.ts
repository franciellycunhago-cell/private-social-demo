"use server";

import { createClient } from "@/lib/supabase/server";
import { salvarSetup, validar } from "@/lib/admin-totp/server";

export async function confirmarSetup(
  secret: string,
  recoveryHashes: string[],
  token: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data: row } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Apenas admins." };

  const clean = token.trim().replace(/\s+/g, "");
  if (clean.length !== 6 || !/^\d+$/.test(clean)) {
    return { error: "Código deve ter 6 dígitos." };
  }

  // Confere que o user de fato escaneou o secret certo (e não está
  // ativando com qualquer 6 dígitos)
  if (!(await validar(secret, clean))) {
    return {
      error:
        "Código inválido. Confira se está olhando o código atual no app.",
    };
  }

  const r = await salvarSetup(user.id, secret, recoveryHashes);
  if ("error" in r) return r;
  return { ok: true };
}
