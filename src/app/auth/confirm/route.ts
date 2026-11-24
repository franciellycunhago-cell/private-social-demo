import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * /auth/confirm
 *
 * Endpoint PKCE-compatível para os emails de ação do Supabase Auth
 * (recovery, signup, email_change, invite, magiclink).
 *
 * O template de email no Supabase Dashboard deve apontar pra cá:
 *
 *   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}&next={{ .RedirectTo }}">
 *
 * - Valida o token via supabase.auth.verifyOtp → estabelece sessão
 * - Redireciona pro `next` (default /app)
 *
 * Referência: https://supabase.com/docs/guides/auth/server-side/email-templates
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_token`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Sucesso — redireciona pra `next` (ex: /redefinir-senha pra recovery)
  // Anti open-redirect: aceita (a) paths relativos `/...` ou (b) URLs do
  // mesmo origin. O template do Supabase manda URL completa
  // (ex: https://example.com/redefinir-senha), então precisamos
  // normalizar extraindo só o pathname.
  let safeNext = "/app";
  if (next.startsWith("/")) {
    safeNext = next;
  } else {
    try {
      const parsed = new URL(next);
      if (parsed.origin === origin) {
        safeNext = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch {
      /* URL inválida — mantém fallback */
    }
  }
  return NextResponse.redirect(`${origin}${safeNext}`);
}
