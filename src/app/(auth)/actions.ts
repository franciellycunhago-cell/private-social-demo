"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/captcha/server";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit/server";
import { consumirConvite } from "@/lib/convites/actions";

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined
  );
}

/* ==================================================================== */
/* Server Actions de autenticação                                         */
/* ==================================================================== */

export type AuthState = {
  error?: string;
  success?: string;
} | null;

function parseCredentials(formData: FormData) {
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  return { email, password };
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = parseCredentials(formData);

  if (!email || !password) {
    return { error: "Preencha email e senha." };
  }

  const ip = await clientIp();
  const captchaToken = formData.get("cf-turnstile-response")?.toString() ?? null;
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) return { error: captcha.error };

  // Rate limit por IP+email pra dificultar bruteforce
  const rlKey = `${ip ?? "noip"}:${email}`;
  const rl = await checkRateLimit("auth_signin", rlKey, { max: 10, windowSec: 900 });
  if (!rl.ok) {
    return {
      error: `Muitas tentativas. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensagens em PT-BR pros erros comuns
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Email ou senha inválidos." };
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        error:
          "Você precisa confirmar seu email antes de entrar. Verifique sua caixa de entrada.",
      };
    }
    return { error: error.message };
  }

  redirect("/app");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = parseCredentials(formData);

  if (!email || !password) {
    return { error: "Preencha email e senha." };
  }
  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  // Aceite obrigatório dos termos (defesa em profundidade — front já
  // bloqueia mas validamos no server pra evitar bypass via DevTools)
  const aceitouTermos =
    formData.get("termos_aceitos") === "on" ||
    formData.get("termos_aceitos") === "true";
  if (!aceitouTermos) {
    return {
      error:
        "Você precisa aceitar os Termos de Uso e a Política de Privacidade.",
    };
  }

  const ip = await clientIp();
  const captchaToken = formData.get("cf-turnstile-response")?.toString() ?? null;
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) return { error: captcha.error };

  // 5 cadastros por IP/hora — bloqueia farm de contas
  const rl = await checkRateLimit("auth_signup", ip ?? "noip", { max: 5, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Muitos cadastros desse IP. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return { error: "Esse email já tem conta. Faz login." };
    }
    return { error: error.message };
  }

  // Registra timestamp de aceite dos termos (LGPD/legal)
  if (data.user) {
    void supabase
      .from("profiles")
      .update({ termos_aceitos_em: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  // Tenta consumir código de convite se foi passado (não bloqueia
  // cadastro se inválido — só não vincula).
  const codigoConvite = (formData.get("convite") ?? "").toString().trim();
  if (codigoConvite && data.user) {
    void consumirConvite(codigoConvite, data.user.id);
  }

  // Se o Supabase estiver com "Confirm email" desligado, o signUp já retorna
  // session ativa — login automático, direto pro /onboarding.
  if (data.session) {
    redirect("/app");
  }

  // Caso contrário (email confirmation ligado), mostra mensagem pedindo pra
  // confirmar antes de logar.
  return {
    success:
      "Quase lá. Enviamos um email pra confirmar seu cadastro. Confere sua caixa.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/* ==================================================================== */
/* Reset de senha                                                         */
/* ==================================================================== */

/**
 * Dispara email com link mágico de recovery (válido ~1h). O link aponta pra
 * /auth/callback?code=X&type=recovery que troca code por sessão e manda o
 * usuário pra /redefinir-senha.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (!email) return { error: "Preencha seu email." };

  const ip = await clientIp();
  const captchaToken = formData.get("cf-turnstile-response")?.toString() ?? null;
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) return { error: captcha.error };

  const rl = await checkRateLimit("auth_reset", ip ?? "noip", { max: 5, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Muitas solicitações. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // O template de email no Supabase Dashboard deve estar apontando pra
  // /auth/confirm (ver src/app/auth/confirm/route.ts). O `redirectTo`
  // aqui vira o `{{ .RedirectTo }}` no template — usado como `next` após
  // verifyOtp. Precisa ser URL sem query string pra não ser truncado.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/redefinir-senha`,
  });

  // Independente de o email existir ou não, retornamos a mesma mensagem
  // (evita que a tela de recuperação vire um enumerador de emails válidos).
  if (error) {
    // Log interno, silenciado pra o user
    console.error("resetPasswordForEmail:", error.message);
  }

  return {
    success:
      "Se esse email tem conta, enviamos um link pra redefinir sua senha. Confere sua caixa (e o spam).",
  };
}

/**
 * Redefine a senha do usuário autenticado (session de recovery ou normal).
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = (formData.get("password") ?? "").toString();
  const confirm = (formData.get("confirm") ?? "").toString();

  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "As duas senhas não batem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Pede um novo link." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/app");
}
