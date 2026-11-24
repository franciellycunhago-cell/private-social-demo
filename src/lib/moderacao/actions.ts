"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit/server";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions — moderação (bloqueio + denúncia)
 *
 *  - bloquearPerfil(targetId)   : adiciona em bloqueios (mútuo via app)
 *  - desbloquearPerfil(targetId)
 *  - denunciarPerfil(targetId, motivo, detalhes)
 *  - listarMeusBloqueios()      : helper pra carregar a lista
 * ================================================================== */

export type MotivoDenuncia =
  | "perfil_falso"
  | "conteudo_inapropriado"
  | "assedio"
  | "menor_de_idade"
  | "outro";

const MOTIVOS_VALIDOS: readonly MotivoDenuncia[] = [
  "perfil_falso",
  "conteudo_inapropriado",
  "assedio",
  "menor_de_idade",
  "outro",
];

export async function bloquearPerfil(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === targetId) return { error: "Você não pode bloquear a si mesmo." };

  const rl = await checkRateLimit("bloqueio", user.id, { max: 30, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Você bloqueou muitos perfis em pouco tempo. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const admin = adminClient();
  const { error } = await admin
    .from("bloqueios")
    .insert({ de_id: user.id, para_id: targetId });

  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/app/descobrir");
  revalidatePath(`/app/p/${targetId}`);
  return { ok: true };
}

export async function desbloquearPerfil(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  const { error } = await admin
    .from("bloqueios")
    .delete()
    .eq("de_id", user.id)
    .eq("para_id", targetId);

  if (error) return { error: error.message };

  revalidatePath("/app/descobrir");
  revalidatePath(`/app/p/${targetId}`);
  return { ok: true };
}

export async function denunciarPerfil(
  targetId: string,
  motivo: string,
  detalhes?: string,
  anexoPath?: string | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === targetId)
    return { error: "Você não pode denunciar a si mesmo." };
  if (!MOTIVOS_VALIDOS.includes(motivo as MotivoDenuncia)) {
    return { error: "Motivo inválido." };
  }

  const rl = await checkRateLimit("denuncia", user.id, { max: 5, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Você fez muitas denúncias em pouco tempo. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const cleanDescricao = (detalhes ?? "").trim().slice(0, 1000) || null;

  let cleanAnexo: string | null = null;
  if (anexoPath) {
    if (!anexoPath.startsWith(`${user.id}/`)) {
      return { error: "Caminho do anexo inválido." };
    }
    cleanAnexo = anexoPath;
  }

  const admin = adminClient();
  const { error } = await admin.from("denuncias").insert({
    denunciante_id: user.id,
    denunciado_id: targetId,
    motivo,
    descricao: cleanDescricao,
    anexo_url: cleanAnexo,
  });

  if (error) {
    // Cleanup do anexo se o insert falhou
    if (cleanAnexo) {
      await admin.storage.from("denuncias-anexos").remove([cleanAnexo]);
    }
    return { error: error.message };
  }
  return { ok: true };
}

export async function marcarDenuncia(
  id: string,
  status: "em_analise" | "resolvida",
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Confere admin
  const { data: adminRow } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!adminRow) return { error: "Apenas admins." };

  const admin = adminClient();
  const { error } = await admin
    .from("denuncias")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/denuncias");
  return { ok: true };
}
