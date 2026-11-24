"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * /app/perfil/ajustes — server actions
 *
 *  - atualizarNotifPrefs(prefs): salva toggles de notificação em
 *    profiles.notif_prefs (jsonb).
 *
 *  - atualizarSenha(senhaAtual, senhaNova): valida senha atual via
 *    signInWithPassword e troca via updateUser.
 *
 *  - atualizarEmail(novoEmail): chama updateUser({email}). Supabase
 *    envia confirmação pro novo endereço; só efetiva após clique.
 *
 *  - sairDeTodasSessoes(): signOut com scope global — invalida todos
 *    os refresh tokens do user, derrubando outros dispositivos.
 * ================================================================== */

export type AjustesResult =
  | { ok: true; mensagem?: string }
  | { error: string };

const NOTIF_KEYS = [
  "matches",
  "mensagens",
  "curtidas_post",
  "comentarios_post",
  "curtida_recebida",
  "eventos_novos",
] as const;

export type NotifPrefs = Record<(typeof NOTIF_KEYS)[number], boolean>;

export type QuemPodeVer = {
  casal: boolean;
  homem: boolean;
  mulher: boolean;
};

export async function atualizarQuemPodeVer(
  prefs: Partial<QuemPodeVer>,
): Promise<AjustesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const clean: QuemPodeVer = {
    casal: !!prefs.casal,
    homem: !!prefs.homem,
    mulher: !!prefs.mulher,
  };

  // Defesa contra "ninguém pode me ver" — mantém ao menos 1 tipo.
  // Sem isso o user some do app pra todo mundo e não consegue match.
  if (!clean.casal && !clean.homem && !clean.mulher) {
    return {
      error: "Selecione pelo menos um tipo. Senão você some do app pra todo mundo.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ quem_pode_ver: clean })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/perfil/ajustes");
  revalidatePath("/app/descobrir");
  return { ok: true, mensagem: "Quem pode te ver salvo." };
}

export async function atualizarNotifPrefs(
  prefs: Partial<NotifPrefs>,
): Promise<AjustesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Sanitiza: só aceita chaves conhecidas, valor booleano
  const clean: NotifPrefs = {
    matches: !!prefs.matches,
    mensagens: !!prefs.mensagens,
    curtidas_post: !!prefs.curtidas_post,
    comentarios_post: !!prefs.comentarios_post,
    curtida_recebida: !!prefs.curtida_recebida,
    eventos_novos: !!prefs.eventos_novos,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ notif_prefs: clean })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/perfil/ajustes");
  return { ok: true, mensagem: "Preferências salvas." };
}

export async function atualizarSenha(
  senhaAtual: string,
  senhaNova: string,
): Promise<AjustesResult> {
  if (senhaNova.length < 8) {
    return { error: "A senha nova deve ter pelo menos 8 caracteres." };
  }
  if (senhaNova === senhaAtual) {
    return { error: "A senha nova deve ser diferente da atual." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Sessão expirou." };

  // Valida senha atual reautenticando — Supabase não tem checagem direta
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senhaAtual,
  });
  if (signErr) {
    return { error: "Senha atual incorreta." };
  }

  const { error } = await supabase.auth.updateUser({ password: senhaNova });
  if (error) return { error: error.message };

  return { ok: true, mensagem: "Senha atualizada." };
}

export async function atualizarEmail(
  novoEmail: string,
): Promise<AjustesResult> {
  const limpo = novoEmail.trim().toLowerCase();
  if (!limpo.includes("@") || limpo.length < 5) {
    return { error: "Email inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  if (user.email === limpo) {
    return { error: "Esse já é o seu email atual." };
  }

  const { error } = await supabase.auth.updateUser({ email: limpo });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "Esse email já está em uso." };
    }
    return { error: error.message };
  }

  return {
    ok: true,
    mensagem:
      "Enviamos um link pro novo email. Confirma lá pra trocar (o atual continua valendo até confirmar).",
  };
}

export async function sairDeTodasSessoes(): Promise<AjustesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // scope: 'global' invalida todos os refresh tokens do user (inclusive
  // este). A próxima request vai cair no /login.
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) return { error: error.message };

  return { ok: true, mensagem: "Todas as sessões foram encerradas." };
}
