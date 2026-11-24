"use server";

import { createClient } from "@/lib/supabase/server";
import {
  consumirRecoveryCode,
  getSecret,
  marcarVerificado,
  validar,
} from "@/lib/admin-totp/server";

async function ensureAdmin(): Promise<{ ok: true; userId: string } | { error: string }> {
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
  return { ok: true, userId: user.id };
}

export async function verificarTotp(
  token: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const data = await getSecret(auth.userId);
  if (!data) return { error: "TOTP não configurado." };

  const clean = token.trim().replace(/\s+/g, "");
  if (clean.length !== 6 || !/^\d+$/.test(clean)) {
    return { error: "Código deve ter 6 dígitos." };
  }
  if (!(await validar(data.secret, clean))) {
    return { error: "Código inválido. Tenta o atual no app." };
  }

  await marcarVerificado(auth.userId);
  return { ok: true };
}

export async function usarRecoveryCode(
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const clean = code.trim().toUpperCase();
  if (!clean) return { error: "Cola um código de recuperação." };

  const ok = await consumirRecoveryCode(auth.userId, clean);
  if (!ok) return { error: "Código inválido ou já usado." };
  return { ok: true };
}
