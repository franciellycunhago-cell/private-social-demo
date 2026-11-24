import webpush from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:contact@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Client com service role para bypassar RLS ao buscar subscriptions de outro usuário
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Tipos de evento que podem virar push. Cada um tem uma flag em
 * profiles.notif_prefs (jsonb) que o user controla em /app/perfil/ajustes.
 *
 * Se a flag estiver false, o push é silenciosamente descartado.
 * Se profiles.notif_prefs ainda não existe (perfis legacy antes da
 * migration 20260426000006), assume todos true.
 */
export type PushTipo =
  | "matches"
  | "mensagens"
  | "curtidas_post"
  | "comentarios_post"
  | "curtida_recebida"
  | "eventos_novos";

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  tipo?: PushTipo,
): Promise<void> {
  try {
    const supabase = adminClient();

    // Respeita preferências de notificação do destinatário
    if (tipo) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("notif_prefs")
        .eq("id", userId)
        .maybeSingle<{ notif_prefs: Record<string, boolean> | null }>();
      const prefs = prof?.notif_prefs;
      // Default: se prefs ausente OU chave ausente, assume true (backward compat)
      if (prefs && prefs[tipo] === false) return;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", userId);

    if (!subs?.length) return;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: {
                p256dh: sub.p256dh as string,
                auth: sub.auth as string,
              },
            },
            JSON.stringify({
              ...payload,
              icon: "/logo-icon.png",
              badge: "/logo-icon.png",
            }),
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await adminClient()
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      }),
    );
  } catch {
    // Nunca deixa a notificação quebrar a action principal
  }
}
