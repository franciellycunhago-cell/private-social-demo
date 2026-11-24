"use client";

import Link from "next/link";
import {
  notificacaoDestino,
  type NotificacaoTipo,
} from "@/lib/notificacoes";

/* ====================================================================
 * NotificacoesList — render client das notificações.
 *
 * Cada item é um <Link> (server-rendered URL) pro destino calculado
 * em notificacaoDestino. Itens não-lidos têm fundo dourado sutil +
 * dot rosa do lado, igual D4/Insta.
 * ================================================================== */

export type NotificacaoItem = {
  id: string;
  tipo: NotificacaoTipo;
  lida: boolean;
  createdAt: string;
  postId: string | null;
  commentId: string | null;
  matchId: string | null;
  fotoId: string | null;
  metadata: Record<string, unknown>;
  actor: {
    id: string;
    nome: string;
    handle: string | null;
    capa: string | null;
  } | null;
};

export function NotificacoesList({ items }: { items: NotificacaoItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-center gap-2 mx-5 mt-8"
        style={{ padding: 32 }}
      >
        <div style={{ fontSize: 36 }}>🔔</div>
        <div
          className="display"
          style={{ fontSize: 18, fontWeight: 500, color: "var(--text-1)" }}
        >
          Nenhuma notificação ainda
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.5,
            maxWidth: 260,
          }}
        >
          Quando alguém curtir, comentar ou der match com você, a gente
          te avisa por aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((n) => {
        const destino = notificacaoDestino({
          tipo: n.tipo,
          actor_id: n.actor?.id ?? null,
          post_id: n.postId,
          match_id: n.matchId,
          foto_id: n.fotoId,
        });
        return (
          <Link
            key={n.id}
            href={destino}
            className="flex items-center gap-3"
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              textDecoration: "none",
              background: !n.lida
                ? "linear-gradient(90deg, rgba(212,175,110,0.06), transparent 60%)"
                : "transparent",
            }}
          >
            <div className="relative flex-shrink-0">
              <div
                className="overflow-hidden"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid var(--gold-600)",
                  background: "var(--bg-2)",
                }}
              >
                {n.actor?.capa ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={n.actor.capa}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: "cover" }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ color: "var(--gold-300)", fontSize: 16 }}
                  >
                    ♥
                  </div>
                )}
              </div>
              {/* Badge do tipo (ícone pequeno em cima do avatar) */}
              <TipoBadge tipo={n.tipo} />
            </div>

            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-0)",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {n.actor?.nome ?? "Alguém"}
                </span>{" "}
                <span style={{ color: "var(--text-1)" }}>
                  {textoNotif(n)}
                </span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  marginTop: 2,
                  letterSpacing: 0.5,
                }}
              >
                {tempoRelativo(n.createdAt)}
              </div>
            </div>

            {!n.lida && (
              <span
                aria-label="Nova"
                style={{
                  flexShrink: 0,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ff4c6b",
                }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

function textoNotif(n: NotificacaoItem): string {
  switch (n.tipo) {
    case "curtiu_post":
      return "curtiu seu post.";
    case "comentou_post": {
      const preview =
        typeof n.metadata.preview === "string" ? n.metadata.preview : "";
      return preview
        ? `comentou: "${preview}"`
        : "comentou no seu post.";
    }
    case "curtiu_perfil":
      return "curtiu seu perfil.";
    case "curtiu_foto":
      return "curtiu sua foto.";
    case "match":
      return "deu match com você. 🎉";
    case "mensagem":
      return "te enviou uma mensagem.";
    case "pedido_privado":
      return "pediu acesso às suas fotos privadas.";
    case "pedido_aprovado":
      return "liberou as fotos privadas pra você.";
    case "evento_novo":
      return "novo evento publicado!";
    case "lembrete_admin": {
      const msg =
        typeof n.metadata.mensagem === "string"
          ? n.metadata.mensagem
          : "lembrete do PrivateSocial";
      return msg;
    }
    default:
      return "";
  }
}

function TipoBadge({ tipo }: { tipo: NotificacaoTipo }) {
  let icone = "♥";
  let bg = "#ff4c6b";

  switch (tipo) {
    case "curtiu_post":
    case "curtiu_perfil":
    case "curtiu_foto":
      icone = "♥";
      bg = "#ff4c6b";
      break;
    case "comentou_post":
      icone = "💬";
      bg = "var(--gold-500)";
      break;
    case "match":
      icone = "✨";
      bg = "var(--shine-gold)";
      break;
    case "mensagem":
      icone = "✉";
      bg = "var(--gold-500)";
      break;
    case "pedido_privado":
    case "pedido_aprovado":
      icone = "🔒";
      bg = "var(--gold-500)";
      break;
    case "evento_novo":
      icone = "📅";
      bg = "var(--gold-500)";
      break;
    case "lembrete_admin":
      icone = "📸";
      bg = "var(--shine-gold)";
      break;
  }

  return (
    <span
      aria-hidden
      className="absolute flex items-center justify-center"
      style={{
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: bg,
        border: "2px solid var(--bg-0)",
        fontSize: 9,
        fontWeight: 700,
        color: typeof bg === "string" && bg.startsWith("#") ? "#fff" : "#1a0f05",
      }}
    >
      {icone}
    </span>
  );
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
