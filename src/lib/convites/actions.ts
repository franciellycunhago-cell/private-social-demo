"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit/server";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_CONVITES_ATIVOS = 5;
const VALIDADE_DIAS = 30;
const PREFIX = "PSC";

/* ====================================================================
 * Server actions de convites.
 *
 *  - gerarConvite()         : cria novo código (limite 5 ativos/user)
 *  - cancelarConvite(id)    : apaga convite não-usado
 *  - consumirConvite(codigo): chamado dentro do signUp se houver código
 *
 * Códigos: PSC-XXXX-XXXX (8 chars hex em uppercase, separados em 4+4).
 * ================================================================== */

function gerarCodigo(): string {
  const raw = randomBytes(4).toString("hex").toUpperCase();
  return `${PREFIX}-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export async function gerarConvite(): Promise<
  { ok: true; codigo: string; expiraEm: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Verifica que está verificado
  const { data: prof } = await supabase
    .from("profiles")
    .select("verificado")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.verificado) {
    return {
      error: "Só perfis verificados podem gerar convites.",
    };
  }

  // Rate limit: 10 gerações por hora (cobre criar 5 + tentativas)
  const rl = await checkRateLimit("convite_gerar", user.id, {
    max: 10,
    windowSec: 3600,
  });
  if (!rl.ok) {
    return {
      error: `Devagar. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const admin = adminClient();

  // Limite de ativos (não-usado, não-expirado)
  const agora = new Date().toISOString();
  const { count } = await admin
    .from("convites")
    .select("*", { count: "exact", head: true })
    .eq("convidante_id", user.id)
    .is("usado_em", null)
    .gt("expira_em", agora);

  if ((count ?? 0) >= MAX_CONVITES_ATIVOS) {
    return {
      error: `Você já tem ${MAX_CONVITES_ATIVOS} convites ativos. Cancela algum ou espera ele ser usado.`,
    };
  }

  // Gera código único — em colisão astronômica, tenta de novo
  let codigo = gerarCodigo();
  for (let i = 0; i < 5; i++) {
    const { data: jaExiste } = await admin
      .from("convites")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    if (!jaExiste) break;
    codigo = gerarCodigo();
  }

  const expiraEm = new Date(
    Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await admin.from("convites").insert({
    codigo,
    convidante_id: user.id,
    expira_em: expiraEm,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/perfil/convites");
  return { ok: true, codigo, expiraEm };
}

export async function cancelarConvite(
  conviteId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  const { data: convite } = await admin
    .from("convites")
    .select("convidante_id, usado_em")
    .eq("id", conviteId)
    .maybeSingle();

  if (!convite) return { error: "Convite não encontrado." };
  if (convite.convidante_id !== user.id) {
    return { error: "Você não pode cancelar esse convite." };
  }
  if (convite.usado_em) {
    return { error: "Convite já foi usado, não dá pra cancelar." };
  }

  const { error } = await admin
    .from("convites")
    .delete()
    .eq("id", conviteId);

  if (error) return { error: error.message };

  revalidatePath("/app/perfil/convites");
  return { ok: true };
}

/**
 * Chamado server-side dentro do fluxo de signup.
 * Valida o código, marca como usado e vincula o convidado.
 * Retorna ok mesmo se o código for inválido (cadastro segue,
 * mas convite não é vinculado) — pra não bloquear cadastro
 * por código errado.
 */
export async function consumirConvite(
  codigo: string,
  convidadoId: string,
): Promise<{ vinculado: boolean }> {
  const clean = codigo.trim().toUpperCase();
  if (!clean) return { vinculado: false };

  const admin = adminClient();
  const agora = new Date().toISOString();

  const { data: convite } = await admin
    .from("convites")
    .select("id, convidante_id")
    .eq("codigo", clean)
    .is("usado_em", null)
    .gt("expira_em", agora)
    .maybeSingle();

  if (!convite) return { vinculado: false };

  // Não pode ser auto-convite
  if (convite.convidante_id === convidadoId) return { vinculado: false };

  const { error } = await admin
    .from("convites")
    .update({ usado_em: agora, convidado_id: convidadoId })
    .eq("id", convite.id)
    .is("usado_em", null);

  if (error) return { vinculado: false };
  return { vinculado: true };
}
