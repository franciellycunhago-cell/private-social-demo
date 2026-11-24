"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Experiencia, ProfileTipo } from "@/lib/supabase/profile";

/** Service-role client — bypassa RLS. Usar com cuidado: só após
 *  verificar a identidade do user pela sessão. */
function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions /app/perfil/editar
 *
 *  - updateProfile: campos editáveis do perfil
 *  - registerPhoto: grava linha em `fotos` após upload direto do client
 *  - deletePhoto: remove linha + objeto do bucket
 *  - reorderPhotos: atualiza `ordem` (drag-and-drop básico pra depois)
 * ================================================================== */

const TIPOS: readonly ProfileTipo[] = ["casal", "homem", "mulher"];
const EXPERIENCIAS: readonly Experiencia[] = [
  "curioso",
  "iniciante",
  "experiente",
  "veterano",
];
const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;

const MAX_PUB = 6;
// Privadas: sem limite. A privacidade é dada pelo gating de pedidos
// de acesso, não pela quantidade.

export type UpdateProfileState = {
  error?: string;
  ok?: true;
} | null;

function parseList(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  return [];
}

function parseAge(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const handle = (formData.get("handle") ?? "").toString().toLowerCase().trim();
  if (!HANDLE_RE.test(handle)) {
    return { error: "Handle inválido. Use 3–30 caracteres: letras, números, . e _" };
  }
  const { data: handleTaken } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", user.id)
    .maybeSingle();
  if (handleTaken) return { error: `@${handle} já está em uso. Escolha outro.` };

  const tipo = (formData.get("tipo") ?? "").toString() as ProfileTipo;
  if (!TIPOS.includes(tipo)) return { error: "Escolha quem você é." };

  const nome = (formData.get("nome_exibicao") ?? "").toString().trim();
  if (!nome) return { error: "Nome de exibição é obrigatório." };

  const idade1 = parseAge(formData.get("idade_1"));
  const idade2 = parseAge(formData.get("idade_2"));
  if (idade1 === null || idade1 < 18) return { error: "Idade mínima é 18." };
  if (tipo === "casal" && (idade2 === null || idade2 < 18)) {
    return { error: "Idade dos dois: mínimo 18." };
  }

  const cidade = (formData.get("cidade") ?? "").toString().trim();
  if (!cidade) return { error: "Cidade é obrigatória." };
  const estadoRaw = (formData.get("estado") ?? "").toString().trim();
  const estado = estadoRaw || null;

  const experiencia = (formData.get("experiencia") ?? "").toString() as Experiencia;
  if (!EXPERIENCIAS.includes(experiencia)) {
    return { error: "Selecione um nível de experiência." };
  }

  const bioRaw = (formData.get("bio") ?? "").toString().trim();
  const bio = bioRaw || null;

  const intencoes = parseList(formData.get("intencoes"));
  if (intencoes.length === 0) return { error: "Selecione ao menos uma intenção." };
  const limites = parseList(formData.get("limites"));

  const { error } = await supabase
    .from("profiles")
    .update({
      handle,
      tipo,
      nome_exibicao: nome,
      idade_1: idade1,
      idade_2: tipo === "casal" ? idade2 : null,
      cidade,
      estado,
      experiencia,
      bio,
      intencoes,
      limites,
    })
    .eq("id", user.id);

  if (error?.code === "23505") return { error: `@${handle} já está em uso. Escolha outro.` };
  if (error) return { error: error.message };

  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/editar");
  return { ok: true };
}

export type ReorderResult = { ok: true } | { error: string };

export async function reorderPhotos(
  items: { id: string; ordem: number }[],
): Promise<ReorderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  // Usa service role pra fazer o UPDATE (bypassa RLS). Antes valida
  // que TODAS as fotos da operação pertencem ao user logado.
  const admin = serviceClient();
  const ids = items.map((i) => i.id);
  const { data: minhas, error: readErr } = await admin
    .from("fotos")
    .select("id")
    .in("id", ids)
    .eq("profile_id", user.id);
  if (readErr) return { error: readErr.message };
  if ((minhas?.length ?? 0) !== ids.length) {
    return { error: "Alguma foto não pertence a você." };
  }

  // UPDATE em paralelo via service role
  const results = await Promise.all(
    items.map(({ id, ordem }) =>
      admin.from("fotos").update({ ordem }).eq("id", id).select("id"),
    ),
  );
  const failed = results.find((r) => r.error || (r.data?.length ?? 0) === 0);
  if (failed) {
    const msg = failed.error?.message ?? "Não foi possível reordenar.";
    return { error: msg };
  }

  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/fotos");
  revalidatePath("/app/perfil/fotos-privadas");
  revalidatePath("/app/perfil/editar");
  return { ok: true };
}

export type RegisterPhotoState = {
  error?: string;
  ok?: true;
} | null;

export async function registerPhoto(
  _prev: RegisterPhotoState,
  formData: FormData,
): Promise<RegisterPhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const path = (formData.get("path") ?? "").toString().trim();
  const tipo = (formData.get("tipo") ?? "").toString() as "publica" | "privada";
  if (!path) return { error: "Caminho do arquivo ausente." };
  if (tipo !== "publica" && tipo !== "privada") {
    return { error: "Tipo de foto inválido." };
  }

  if (!path.startsWith(`${user.id}/`)) {
    return { error: "Caminho inválido." };
  }

  // Conta atual (pra ordenar a nova) + impõe limite só pras públicas
  // (privadas são ilimitadas — privacidade é dada pelo gating de pedidos)
  const { count: atual } = await supabase
    .from("fotos")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("tipo", tipo);

  if (tipo === "publica" && atual !== null && atual >= MAX_PUB) {
    return { error: `Máximo de ${MAX_PUB} fotos públicas.` };
  }

  const { error } = await supabase.from("fotos").insert({
    profile_id: user.id,
    url: path,
    tipo,
    ordem: atual ?? 0,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/editar");
  return { ok: true };
}

export type DeletePhotoState = {
  error?: string;
  ok?: true;
} | null;

export async function deletePhoto(
  _prev: DeletePhotoState,
  formData: FormData,
): Promise<DeletePhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) return { error: "ID da foto ausente." };

  // Service role pra contornar RLS (UPDATE pode não ter policy)
  const admin = serviceClient();
  const { data: foto, error: readErr } = await admin
    .from("fotos")
    .select("id, url, tipo, profile_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (readErr || !foto) return { error: "Foto não encontrada." };

  // Remove do storage (o arquivo físico some pra não ocupar espaço).
  // Erro silencioso é OK aqui (arquivo pode já estar perdido).
  const bucket = foto.tipo === "publica" ? "fotos-publicas" : "fotos-privadas";
  await admin.storage.from(bucket).remove([foto.url]);

  // Soft delete: mantém o registro no banco pra auditoria do admin.
  // A foto some do feed/perfil do usuário via RLS, mas o admin ainda vê.
  const { error } = await admin
    .from("fotos")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/app/perfil");
  revalidatePath("/app/perfil/editar");
  return { ok: true };
}

/* ====================================================================
 * setFotoCapa — atualiza profile.foto_capa_path.
 *
 * Modos de uso (mesmo action):
 *  - Path vindo de uma posts_fotos.url existente
 *  - Path vindo de upload exclusivo de capa (não vira post)
 *
 * Em ambos os casos, validamos que o path pertence ao próprio user
 * (começa com `${userId}/`).
 * ================================================================== */
export type SetFotoCapaResult = { ok: true } | { error: string };

export async function setFotoCapa(path: string): Promise<SetFotoCapaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const cleanPath = (path ?? "").trim();
  if (!cleanPath) return { error: "Path inválido." };

  // Validação básica: tem que começar com o userId/
  if (!cleanPath.startsWith(`${user.id}/`)) {
    return { error: "Caminho não pertence ao seu perfil." };
  }

  const admin = serviceClient();
  const { error } = await admin
    .from("profiles")
    .update({ foto_capa_path: cleanPath })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/app/perfil");
  revalidatePath(`/app/p/${user.id}`);
  revalidatePath("/app/descobrir");
  return { ok: true };
}
