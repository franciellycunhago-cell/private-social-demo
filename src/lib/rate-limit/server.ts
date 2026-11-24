import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Rate limit baseado em tabela Postgres.
 *
 * checkRateLimit("bucket", id, { max: 5, windowSec: 3600 }) → conta
 * eventos do bucket+id na janela; se passou do limite, retorna
 * { ok: false }. Senão insere o evento e retorna { ok: true }.
 *
 * Buckets sugeridos por ação:
 *   "denuncia"        : 5  / 1h     (anti-spam de denúncia)
 *   "bloqueio"        : 30 / 1h     (não trava uso normal)
 *   "post"            : 10 / 1h     (não publicar mais que isso por hora)
 *   "comentario"      : 60 / 1h     (1/min é razoável)
 *   "post_like"       : 300/ 1h     (like é click-feliz)
 *   "request_privado" : 20 / 1h
 *   "auth_signin"     : 10 / 15min  (anti-bruteforce)
 *   "auth_signup"     : 5  / 1h
 * ================================================================== */

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  opts: { max: number; windowSec: number },
): Promise<RateLimitResult> {
  if (!identifier) return { ok: true }; // sem id → não dá pra limitar
  const admin = adminClient();
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();

  // Conta os eventos na janela
  const { count, error: countErr } = await admin
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("identifier", identifier)
    .gte("created_at", since);

  if (countErr) {
    // Falha no banco — libera (não punir user por bug nosso)
    console.warn("rate_limit count falhou:", countErr.message);
    return { ok: true };
  }

  const atual = count ?? 0;
  if (atual >= opts.max) {
    // Pega o mais antigo dentro da janela pra estimar retry-after
    const { data: oldest } = await admin
      .from("rate_limit_events")
      .select("created_at")
      .eq("bucket", bucket)
      .eq("identifier", identifier)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    let retryAfter = opts.windowSec;
    if (oldest?.created_at) {
      const elapsed = Math.floor(
        (Date.now() - new Date(oldest.created_at as string).getTime()) / 1000,
      );
      retryAfter = Math.max(1, opts.windowSec - elapsed);
    }
    return { ok: false, retryAfterSec: retryAfter };
  }

  // Passou — registra
  await admin
    .from("rate_limit_events")
    .insert({ bucket, identifier });

  return { ok: true };
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}min`;
  return `${Math.ceil(seconds / 3600)}h`;
}
