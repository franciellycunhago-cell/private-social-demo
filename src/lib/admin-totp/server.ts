import {
  generateSecret as otpGenerateSecret,
  generateURI as otpGenerateURI,
  verify as otpVerify,
} from "otplib";
import { createHash, randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VERIFICACAO_VALIDA_HORAS = 8;
const ISSUER = "PrivateSocial";

/* ====================================================================
 * Lib server-side de TOTP pra admin.
 *
 *  PAUSADO em 26/04/26 — cliente não quer cobrar TOTP a cada 8h.
 *  Arquivos mantidos no repo pra reativar (descomentar bloco em
 *  src/app/admin/layout.tsx). API atualizada pra otplib v13.
 *
 *  - generateSecret() : cria novo secret base32
 *  - keyUri(secret, label) : URL otpauth:// pra QR code
 *  - validar(secret, token) : confere código de 6 dígitos (async em v13)
 *  - generateRecoveryCodes() : 10 códigos de uso único
 *  - hashRecoveryCode(code) : sha256
 * ================================================================== */

export function generateSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

export function keyUri(secret: string, label: string): string {
  return otpGenerateURI({
    strategy: "totp",
    issuer: ISSUER,
    label,
    secret,
  });
}

export async function validar(
  secret: string,
  token: string,
): Promise<boolean> {
  if (!token || token.length < 6) return false;
  try {
    const r = await otpVerify({
      strategy: "totp",
      secret,
      token: token.replace(/\s+/g, ""),
    });
    return !!r?.valid;
  } catch {
    return false;
  }
}

export function generateRecoveryCodes(): string[] {
  // 10 códigos de 8 chars hex maiúsculo, formato XXXX-XXXX
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(code.replace(/-/g, "").toUpperCase())
    .digest("hex");
}

/* --------------------------- estado --------------------------- */

export type TotpState =
  | { state: "nao_configurado" }
  | { state: "configurado"; verificadoRecente: boolean };

export async function getAdminTotpState(
  profileId: string,
): Promise<TotpState> {
  const admin = adminClient();
  const { data } = await admin
    .from("admin_totp")
    .select("last_verified_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data) return { state: "nao_configurado" };

  const lastVerified = data.last_verified_at as string | null;
  if (!lastVerified) {
    return { state: "configurado", verificadoRecente: false };
  }

  const elapsedMs = Date.now() - new Date(lastVerified).getTime();
  const validoMs = VERIFICACAO_VALIDA_HORAS * 60 * 60 * 1000;
  return {
    state: "configurado",
    verificadoRecente: elapsedMs < validoMs,
  };
}

/* --------------------------- writes --------------------------- */

export async function salvarSetup(
  profileId: string,
  secret: string,
  recoveryCodesHashed: string[],
): Promise<{ ok: true } | { error: string }> {
  const admin = adminClient();
  const { error } = await admin.from("admin_totp").upsert(
    {
      profile_id: profileId,
      secret_base32: secret,
      recovery_codes_hashed: recoveryCodesHashed,
      ativado_em: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function getSecret(profileId: string): Promise<{
  secret: string;
  recoveryHashes: string[];
} | null> {
  const admin = adminClient();
  const { data } = await admin
    .from("admin_totp")
    .select("secret_base32, recovery_codes_hashed")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  return {
    secret: data.secret_base32 as string,
    recoveryHashes: (data.recovery_codes_hashed as string[]) ?? [],
  };
}

export async function marcarVerificado(profileId: string): Promise<void> {
  const admin = adminClient();
  await admin
    .from("admin_totp")
    .update({ last_verified_at: new Date().toISOString() })
    .eq("profile_id", profileId);
}

export async function consumirRecoveryCode(
  profileId: string,
  code: string,
): Promise<boolean> {
  const admin = adminClient();
  const target = hashRecoveryCode(code);
  const { data } = await admin
    .from("admin_totp")
    .select("recovery_codes_hashed")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return false;

  const codes = (data.recovery_codes_hashed as string[]) ?? [];
  if (!codes.includes(target)) return false;

  const remaining = codes.filter((c) => c !== target);
  await admin
    .from("admin_totp")
    .update({
      recovery_codes_hashed: remaining,
      last_verified_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);
  return true;
}
