"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Experiencia,
  OnboardingData,
  ProfileTipo,
} from "@/lib/supabase/profile";

/* ====================================================================
 * Server Actions do Onboarding
 * - saveOnboarding: salva todos os campos do formulário em profiles
 *   e redireciona pra /verificacao.
 * ================================================================== */

const TIPOS: readonly ProfileTipo[] = ["casal", "homem", "mulher"];
const EXPERIENCIAS: readonly Experiencia[] = [
  "curioso",
  "iniciante",
  "experiente",
  "veterano",
];
const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;
const TELEFONE_RE = /^\(\d{2}\) \d{4,5}-\d{4}$/;

export type OnboardingState = {
  error?: string;
} | null;

function parseAge(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

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

export async function saveOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const tipo = (formData.get("tipo") ?? "").toString() as ProfileTipo;
  if (!TIPOS.includes(tipo)) return { error: "Escolha quem você é." };

  const handle = (formData.get("handle") ?? "").toString().toLowerCase().trim();
  if (!HANDLE_RE.test(handle)) {
    return { error: "Handle inválido. Use 3–30 caracteres: letras, números, . e _" };
  }

  const nome = (formData.get("nome_exibicao") ?? "").toString().trim();
  if (!nome) return { error: "Como você quer aparecer?" };

  const idade1 = parseAge(formData.get("idade_1"));
  const idade2 = parseAge(formData.get("idade_2"));
  if (idade1 === null || idade1 < 18) {
    return { error: "Idade mínima é 18 anos." };
  }
  if (tipo === "casal") {
    if (idade2 === null || idade2 < 18) {
      return { error: "Idade dos dois: mínimo 18." };
    }
  }

  const cidade = (formData.get("cidade") ?? "").toString().trim();
  if (!cidade) return { error: "De onde você é?" };
  const estadoRaw = (formData.get("estado") ?? "").toString().trim();
  const estado = estadoRaw || null;

  const experiencia = (formData.get("experiencia") ?? "")
    .toString() as Experiencia;
  if (!EXPERIENCIAS.includes(experiencia)) {
    return { error: "Conta pra gente sua experiência." };
  }

  const bioRaw = (formData.get("bio") ?? "").toString().trim();
  const bio = bioRaw || null;

  const telefone = (formData.get("telefone") ?? "").toString().trim();
  if (!TELEFONE_RE.test(telefone)) {
    return { error: "Informe um celular válido: (XX) XXXXX-XXXX" };
  }

  const intencoes = parseList(formData.get("intencoes"));
  if (intencoes.length === 0) {
    return { error: "Seleciona ao menos uma intenção." };
  }
  const limites = parseList(formData.get("limites"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const { data: handleTaken } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", user.id)
    .maybeSingle();
  if (handleTaken) return { error: `@${handle} já está em uso. Escolha outro.` };

  const payload: OnboardingData = {
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
    telefone,
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      handle,
      tipo: payload.tipo,
      nome_exibicao: payload.nome_exibicao,
      idade_1: payload.idade_1,
      idade_2: payload.idade_2,
      cidade: payload.cidade,
      estado: payload.estado,
      experiencia: payload.experiencia,
      bio: payload.bio,
      intencoes: payload.intencoes,
      limites: payload.limites,
      telefone: payload.telefone,
    })
    .eq("id", user.id);

  if (error?.code === "23505") {
    return { error: `@${handle} já está em uso. Escolha outro.` };
  }

  if (error) {
    return { error: error.message };
  }

  await supabase.from("eventos_app").insert({
    profile_id: user.id,
    tipo: "onboarding_completed",
    metadata: { intencoes: payload.intencoes, limites: payload.limites },
  });

  redirect("/verificacao");
}
