import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * lib/notificacoes — helper pra criar notificações in-app.
 *
 * Notificações são gravadas em `notificacoes` (tabela com RLS) via
 * service role pra evitar que user comum crie notif falsa pra outro.
 * Realtime é via Supabase pub/sub (já incluso na publication
 * supabase_realtime).
 *
 * Uso típico (em server actions):
 *
 *   await createNotificacao({
 *     userId: postOwner,
 *     actorId: user.id,
 *     tipo: "curtiu_post",
 *     postId: postId,
 *   });
 *
 * Não notifica a si mesmo (early return).
 * Nunca lança exceção — falha em silêncio pra não quebrar a action
 * principal (mesmo padrão do sendPushToUser).
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type NotificacaoTipo =
  | "curtiu_post"
  | "comentou_post"
  | "curtiu_perfil"
  | "curtiu_foto"
  | "match"
  | "mensagem"
  | "pedido_privado"
  | "pedido_aprovado"
  | "evento_novo"
  | "lembrete_admin";

export type CreateNotificacaoParams = {
  /** Quem RECEBE a notificação */
  userId: string;
  /** Quem CAUSOU a ação (opcional — eventos do sistema podem não ter) */
  actorId?: string;
  tipo: NotificacaoTipo;
  postId?: string;
  commentId?: string;
  matchId?: string;
  fotoId?: string;
  metadata?: Record<string, unknown>;
};

export async function createNotificacao(
  params: CreateNotificacaoParams,
): Promise<void> {
  // Não notificar a si mesmo
  if (params.actorId && params.actorId === params.userId) return;

  try {
    const admin = adminClient();
    await admin.from("notificacoes").insert({
      user_id: params.userId,
      actor_id: params.actorId ?? null,
      tipo: params.tipo,
      post_id: params.postId ?? null,
      comment_id: params.commentId ?? null,
      match_id: params.matchId ?? null,
      foto_id: params.fotoId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Silencioso — não quebra a action que chamou
  }
}

/**
 * Gera o URL de destino quando o user clicar na notificação. Mantido
 * aqui (em vez de hardcoded) pra ficar consistente entre push e tela.
 */
export function notificacaoDestino(n: {
  tipo: NotificacaoTipo;
  actor_id: string | null;
  post_id: string | null;
  match_id: string | null;
  foto_id?: string | null;
}): string {
  switch (n.tipo) {
    case "match":
      return n.match_id ? `/app/conversas/${n.match_id}` : "/app/conversas";
    case "mensagem":
      return n.match_id ? `/app/conversas/${n.match_id}` : "/app/conversas";
    case "curtiu_post":
    case "comentou_post":
      // Abre o post EM QUESTÃO (no perfil do user, modal automático).
      // Fallback: se não tiver post_id (legacy), abre perfil do actor.
      if (n.post_id) return `/app/perfil?post=${n.post_id}`;
      return n.actor_id ? `/app/p/${n.actor_id}` : "/app/notificacoes";
    case "curtiu_perfil":
      // Abre o perfil de quem curtiu pra ele(a) ver
      return n.actor_id ? `/app/p/${n.actor_id}` : "/app/notificacoes";
    case "curtiu_foto":
      // Vai pro próprio perfil (galeria de fotos) — dono da foto vê
      // a notificação e abre suas fotos
      return n.foto_id
        ? `/app/perfil?foto=${n.foto_id}`
        : "/app/perfil";
    case "pedido_privado":
      // Pedidos chegam na tela de conversas (separados na aba pedidos)
      return "/app/conversas";
    case "pedido_aprovado":
      // Quando aprovam, vai pro perfil de quem aprovou ver as fotos
      return n.actor_id ? `/app/p/${n.actor_id}` : "/app/notificacoes";
    case "evento_novo":
      return "/app/eventos";
    case "lembrete_admin":
      // Lembrete admin → leva direto pra adicionar fotos. Metadata
      // pode customizar (ex: outra rota) mas default é fotos.
      return "/app/perfil/fotos";
    default:
      return "/app/notificacoes";
  }
}
