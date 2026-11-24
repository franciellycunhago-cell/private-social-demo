/**
 * Verifica o token do Cloudflare Turnstile contra a API oficial.
 * Documentação: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Se TURNSTILE_SECRET_KEY não estiver configurado (dev local), retorna
 * "skipped" — o app funciona sem captcha enquanto o user não setar.
 */
export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<TurnstileResult> {
  // Kill-switch de emergência: se CAPTCHA_DISABLED=true no env, libera
  // tudo (usado quando o Turnstile tá com bug em produção). Setar via
  // Vercel env vars e fazer redeploy.
  if (process.env.CAPTCHA_DISABLED === "true") {
    return { ok: true, skipped: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Sem secret configurado → modo soft, libera (dev local)
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, error: "Resolva o desafio anti-bot." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      // Pequeno timeout — Turnstile é rápido
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      return {
        ok: false,
        error:
          "Falha na verificação anti-bot. Tenta de novo ou recarrega a página.",
      };
    }
    return { ok: true };
  } catch {
    // Falhas de rede no Turnstile não devem bloquear login — log e libera
    console.warn("Turnstile verify falhou (timeout ou network)");
    return { ok: true, skipped: true };
  }
}
