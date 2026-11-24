"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Server Actions da verificação
 *
 * O upload da selfie é feito no browser (client component) direto pro
 * Supabase Storage — o Next não precisa passar pelo servidor um blob
 * de vários MB. Depois do upload, o client chama registerVerification
 * com o `object_path` gerado.
 *
 * registerVerification: insere linha em `verificacoes` com status=pendente.
 * ================================================================== */

export type RegisterVerificationState = {
  error?: string;
  ok?: true;
} | null;

function safePath(userId: string, raw: string): string | null {
  // Garante que o path começa com {userId}/ e não contém ".."
  if (!raw || raw.includes("..") || raw.startsWith("/")) return null;
  const prefix = `${userId}/`;
  if (!raw.startsWith(prefix)) return null;
  return raw;
}

export async function registerVerification(
  _prev: RegisterVerificationState,
  formData: FormData,
): Promise<RegisterVerificationState> {
  const rawPath = (formData.get("path") ?? "").toString();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const path = safePath(user.id, rawPath);
  if (!path) return { error: "Upload inválido. Tenta de novo." };

  // Insere verificação. foto_url guarda o path do bucket (privado — só admin lê).
  const { error } = await supabase.from("verificacoes").insert({
    profile_id: user.id,
    foto_url: path,
    status: "pendente",
  });

  if (error) return { error: error.message };

  await supabase.from("eventos_app").insert({
    profile_id: user.id,
    tipo: "verification_submitted",
    metadata: { path },
  });

  revalidatePath("/verificacao");
  return { ok: true };
}

/**
 * Submete uma nova verificação quando a anterior foi rejeitada.
 * Cria nova linha em `verificacoes` (a antiga fica no histórico).
 */
export const resubmitVerification = registerVerification;
