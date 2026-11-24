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
 * Admin actions — suspender, reativar, excluir, cancelar exclusão.
 *
 * Toda action confere que o caller está em public.admins. RLS de
 * profiles continua restritiva pra usuários comuns; o adminClient
 * (service role) bypassa.
 * ================================================================== */

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

export async function suspenderUsuario(
  targetId: string,
  motivo: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const cleanMotivo = motivo.trim().slice(0, 500) || null;
  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      suspenso: true,
      suspenso_em: new Date().toISOString(),
      suspenso_por: auth.userId,
      suspenso_motivo: cleanMotivo,
    })
    .eq("id", targetId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function reativarUsuario(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      suspenso: false,
      suspenso_em: null,
      suspenso_por: null,
      suspenso_motivo: null,
    })
    .eq("id", targetId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function excluirUsuario(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", targetId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function cancelarExclusaoUsuario(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deletado_em: null })
    .eq("id", targetId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/* ====================================================================
 * Posts — fixar/desfixar no topo do feed
 *
 * Posts fixados aparecem antes dos cronológicos pra todo mundo,
 * com badge "📌 Destaque". Útil pra anúncios do Admin.
 * ================================================================== */

export async function fixarPostAdmin(
  postId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("posts")
    .update({ pinned_em: new Date().toISOString() })
    .eq("id", postId);

  if (error) return { error: error.message };
  revalidatePath("/app/descobrir");
  revalidatePath("/admin/feed");
  return { ok: true };
}

export async function desfixarPostAdmin(
  postId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();
  const { error } = await admin
    .from("posts")
    .update({ pinned_em: null })
    .eq("id", postId);

  if (error) return { error: error.message };
  revalidatePath("/app/descobrir");
  revalidatePath("/admin/feed");
  return { ok: true };
}

/* ====================================================================
 * Posts — moderação destrutiva
 *
 * apagarPostAdmin: deleta 1 post (cascade nas fotos/likes/comentários
 * via FK), e tira as imagens do bucket fotos-publicas pra não virar lixo.
 *
 * apagarTodosPostsDoUser: idem, mas pra todos os posts de um perfil.
 * Útil pra limpar contas-teste antes do beta público.
 * ================================================================== */

async function removerArquivosDoStorage(
  admin: ReturnType<typeof adminClient>,
  urls: string[],
) {
  if (urls.length === 0) return;
  // remove em chunks de 100 pra não estourar limite do supabase
  for (let i = 0; i < urls.length; i += 100) {
    const chunk = urls.slice(i, i + 100);
    await admin.storage.from("fotos-publicas").remove(chunk);
  }
}

export async function apagarPostAdmin(
  postId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();

  // Pega URLs das fotos antes de deletar (cascade limpa o registro mas
  // não o objeto físico)
  const { data: fotos } = await admin
    .from("posts_fotos")
    .select("url, post_id, posts:post_id(profile_id)")
    .eq("post_id", postId);

  const urls = ((fotos ?? []) as Array<{ url: string }>).map((f) => f.url);

  // profile_id pra revalidate depois
  const { data: post } = await admin
    .from("posts")
    .select("profile_id")
    .eq("id", postId)
    .maybeSingle<{ profile_id: string }>();

  const { error } = await admin.from("posts").delete().eq("id", postId);
  if (error) return { error: error.message };

  await removerArquivosDoStorage(admin, urls);

  if (post?.profile_id) {
    revalidatePath(`/admin/usuarios/${post.profile_id}`);
    revalidatePath(`/app/p/${post.profile_id}`);
  }
  revalidatePath("/app/descobrir");
  return { ok: true };
}

/* ====================================================================
 * VIP Cortesia — admin dá VIP grátis pra qualquer user
 * ================================================================== */

import type { CortesiaPeriodo } from "./cortesia";

const PERIODOS_DIAS: Record<CortesiaPeriodo, number> = {
  "1mes": 30,
  "3meses": 92,
  "1ano": 366,
  vitalicio: 365 * 70, // ~70 anos = "pra sempre"
};

export async function darVipCortesia(
  targetId: string,
  periodo: CortesiaPeriodo,
  motivo: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  if (!PERIODOS_DIAS[periodo]) {
    return { error: "Período inválido." };
  }
  const cleanMotivo = motivo.trim().slice(0, 300);
  if (!cleanMotivo) {
    return { error: "Diga o motivo da cortesia (ex: parceria, sorteio)." };
  }

  const admin = adminClient();

  // Calcula nova data de expiração
  const dias = PERIODOS_DIAS[periodo];
  const novaExpira = new Date();
  novaExpira.setDate(novaExpira.getDate() + dias);
  const novaExpiraIso = novaExpira.toISOString();

  // Cria registro em assinaturas (status='cortesia')
  const { error: insErr } = await admin.from("assinaturas").insert({
    profile_id: targetId,
    plano: "mensal", // valor neutro — cortesia não cobra
    valor_centavos: 0,
    status: "cortesia",
    ativada_em: new Date().toISOString(),
    expira_em: novaExpiraIso,
    motivo_cortesia: cleanMotivo,
    cortesia_dada_por: auth.userId,
  });
  if (insErr) {
    console.error("Erro inserindo cortesia:", insErr);
    return { error: insErr.message };
  }

  // Atualiza profile.vip_ate
  const { error: updErr } = await admin
    .from("profiles")
    .update({ vip_ate: novaExpiraIso })
    .eq("id", targetId);
  if (updErr) return { error: updErr.message };

  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/assinaturas");
  return { ok: true };
}

export async function revogarVipCortesia(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();

  // Marca cortesia como cancelada (mantém histórico)
  await admin
    .from("assinaturas")
    .update({
      status: "cancelada",
      cancelada_em: new Date().toISOString(),
    })
    .eq("profile_id", targetId)
    .eq("status", "cortesia");

  // Tira VIP do perfil imediatamente
  await admin
    .from("profiles")
    .update({ vip_ate: null })
    .eq("id", targetId);

  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath("/admin/assinaturas");
  return { ok: true };
}

/* ====================================================================
 * Senha provisória — admin gera senha temporária pra usuário que perdeu acesso
 * ================================================================== */

function gerarSenhaProvisoria(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) s += "-";
  }
  return s; // ex: KLUB-49RX
}

export async function resetarSenhaProvisoria(
  targetId: string,
): Promise<{ ok: true; senha: string } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const senha = gerarSenhaProvisoria();
  const admin = adminClient();

  const { error } = await admin.auth.admin.updateUserById(targetId, {
    password: senha,
  });

  if (error) return { error: error.message };
  return { ok: true, senha };
}

/* ==================================================================== */

export async function apagarTodosPostsDoUser(
  targetId: string,
): Promise<{ ok: true; quantos: number } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const admin = adminClient();

  // 1. Pega ids dos posts do user
  const { data: posts, error: ePosts } = await admin
    .from("posts")
    .select("id")
    .eq("profile_id", targetId);
  if (ePosts) return { error: ePosts.message };
  const postIds = ((posts ?? []) as Array<{ id: string }>).map((p) => p.id);

  if (postIds.length === 0) {
    return { ok: true, quantos: 0 };
  }

  // 2. Pega URLs das fotos pra deletar do storage depois
  const { data: fotos } = await admin
    .from("posts_fotos")
    .select("url")
    .in("post_id", postIds);
  const urls = ((fotos ?? []) as Array<{ url: string }>).map((f) => f.url);

  // 3. Deleta os posts (cascade cuida de fotos/likes/comentários no DB)
  const { error: eDel } = await admin.from("posts").delete().in("id", postIds);
  if (eDel) return { error: eDel.message };

  // 4. Limpa storage
  await removerArquivosDoStorage(admin, urls);

  revalidatePath(`/admin/usuarios/${targetId}`);
  revalidatePath(`/app/p/${targetId}`);
  revalidatePath("/app/descobrir");
  return { ok: true, quantos: postIds.length };
}

/* ====================================================================
 * enviarLembreteFotos — dispara lembrete in-app + push pro user que
 * ainda não completou o mínimo de fotos. Mensagem pré-formatada.
 *
 * Faz INSERT direto na tabela notificacoes (não usa o helper) pra
 * propagar erros — assim conseguimos detectar problemas como
 * "tipo não está no enum" caso a migration não tenha rodado.
 * ================================================================== */
export async function enviarLembreteFotos(
  targetId: string,
): Promise<{ ok: true } | { error: string }> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  const { sendPushToUser } = await import("@/lib/push");

  const mensagem =
    "Complete seu perfil — adicione mais fotos pra liberar tudo no app.";

  // Insert direto via service role — propaga erros
  const admin = adminClient();
  const { error: notifErr } = await admin.from("notificacoes").insert({
    user_id: targetId,
    actor_id: auth.userId,
    tipo: "lembrete_admin",
    metadata: { mensagem, motivo: "fotos_incompletas" },
  });

  if (notifErr) {
    // Erros típicos:
    //  - "invalid input value for enum" → falta rodar migration
    //  - violação de FK → user não existe
    const detalhe = notifErr.message ?? "Falha ao registrar notificação.";
    return {
      error: `Notificação não registrada: ${detalhe}. Confira se a migration 20260502000006 rodou no Supabase.`,
    };
  }

  // Push notification — sem tipo passado, vai SEMPRE (admin reminders
  // são críticos, não respeitam toggle de notif_prefs). Fire-and-forget
  // porque o push falhar (ex: user sem device) não invalida o lembrete.
  void sendPushToUser(targetId, {
    title: "PrivateSocial 👑",
    body: mensagem,
    url: "/app/perfil/fotos",
  });

  revalidatePath("/admin/usuarios-incompletos");
  return { ok: true };
}

/* ====================================================================
 * enviarAvisoAdmin — versão genérica que aceita mensagem custom.
 * Usado pelo modal de avisos (templates + textarea editável).
 *
 * Aceita 1 ou N userIds — mesma action serve pra single e batch.
 * Mensagem é validada (não vazia, max 500 chars).
 * ================================================================== */
export async function enviarAvisoAdmin(
  targetIds: string[],
  mensagem: string,
): Promise<
  | { ok: true; enviados: number; falharam: number }
  | { error: string }
> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  // Valida mensagem
  const msgLimpa = mensagem.trim();
  if (!msgLimpa) return { error: "Mensagem não pode ficar vazia." };
  if (msgLimpa.length > 500) {
    return { error: "Mensagem muito longa (máx 500 caracteres)." };
  }

  // Sanitiza ids
  const ids = Array.from(
    new Set(targetIds.filter((id): id is string => typeof id === "string")),
  ).slice(0, 500);
  if (ids.length === 0) return { error: "Nenhum destinatário válido." };

  const { sendPushToUser } = await import("@/lib/push");
  const admin = adminClient();

  // Batch insert
  const rows = ids.map((targetId) => ({
    user_id: targetId,
    actor_id: auth.userId,
    tipo: "lembrete_admin" as const,
    metadata: { mensagem: msgLimpa, motivo: "aviso_admin" },
  }));
  const { error: insertErr } = await admin.from("notificacoes").insert(rows);
  if (insertErr) {
    return {
      error: `Falha no INSERT: ${insertErr.message}. Confira a migration 20260502000006.`,
    };
  }

  // Pushes em paralelo
  const pushResults = await Promise.allSettled(
    ids.map((targetId) =>
      sendPushToUser(targetId, {
        title: "PrivateSocial 👑",
        body: msgLimpa,
        url: "/app/perfil/fotos",
      }),
    ),
  );
  const falharam = pushResults.filter((r) => r.status === "rejected").length;

  revalidatePath("/admin/usuarios-incompletos");
  return { ok: true, enviados: ids.length, falharam };
}

/* ====================================================================
 * enviarLembretesEmLote — versão batch do lembrete de fotos.
 * Insere todas as notificações em UM INSERT só e dispara pushes em
 * paralelo. Retorna contagens de sucesso / falha pra UI mostrar.
 * ================================================================== */
export async function enviarLembretesEmLote(
  targetIds: string[],
): Promise<
  | { ok: true; enviados: number; falharam: number }
  | { error: string }
> {
  const auth = await ensureAdmin();
  if ("error" in auth) return auth;

  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return { error: "Nenhum usuário selecionado." };
  }

  // Sanitiza: só strings, dedup, limita pra evitar abuso
  const ids = Array.from(
    new Set(targetIds.filter((id): id is string => typeof id === "string")),
  ).slice(0, 500);

  if (ids.length === 0) return { error: "Lista vazia após sanitização." };

  const { sendPushToUser } = await import("@/lib/push");

  const mensagem =
    "Complete seu perfil — adicione mais fotos pra liberar tudo no app.";

  const admin = adminClient();

  // Batch insert — uma única chamada de INSERT com múltiplas rows
  const rows = ids.map((targetId) => ({
    user_id: targetId,
    actor_id: auth.userId,
    tipo: "lembrete_admin" as const,
    metadata: { mensagem, motivo: "fotos_incompletas" },
  }));

  const { error: insertErr } = await admin.from("notificacoes").insert(rows);
  if (insertErr) {
    return {
      error: `Falha no batch insert: ${insertErr.message}. Confira se a migration 20260502000006 rodou.`,
    };
  }

  // Pushes em paralelo (fire-and-forget — falha de push não invalida o lembrete)
  const pushResults = await Promise.allSettled(
    ids.map((targetId) =>
      sendPushToUser(targetId, {
        title: "PrivateSocial 👑",
        body: mensagem,
        url: "/app/perfil/fotos",
      }),
    ),
  );
  const falharam = pushResults.filter((r) => r.status === "rejected").length;

  revalidatePath("/admin/usuarios-incompletos");
  return { ok: true, enviados: ids.length, falharam };
}
