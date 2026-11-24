"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ====================================================================
 * BottomNav — 5 abas fixas no rodapé (mobile-first).
 *  Ordem: Descobrir, Radar, Notificações, Conversas, Perfil
 *  - Eventos sai do bottom nav — fica acessível pelo banner do
 *    Descobrir e pelas stories. (decisão 28/04/26)
 *  - Buscar (busca por nome/handle/token) sai do bottom nav e fica
 *    acessível via header do Radar. (decisão 30/04/26 — Radar
 *    engloba a busca por proximidade)
 *  - Link extra "Moderação" só pra admin
 *  - Badge dourado nas abas Conversas e Notificações com contagem
 *    de não lidos. Atualiza via Realtime.
 * ================================================================== */

type Tab = {
  href: string;
  label: string;
  matchPrefix: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: number;
};

export function BottomNav({
  isAdmin,
  userId,
  initialConversasBadge,
  initialNotificacoesBadge,
}: {
  isAdmin: boolean;
  userId: string;
  initialConversasBadge: number;
  initialNotificacoesBadge: number;
}) {
  const pathname = usePathname();
  const [conversasBadge, setConversasBadge] = useState(initialConversasBadge);
  const [notificacoesBadge, setNotificacoesBadge] = useState(
    initialNotificacoesBadge,
  );
  const supabase = useMemo(() => createClient(), []);

  // Sincroniza quando o server re-renderiza com valor novo (ex: depois de
  // abrir uma conversa e marcar como lida, o router.refresh() devolve
  // initialConversasBadge atualizado). Se for igual ao valor atual,
  // o setState é no-op.
  useEffect(() => {
    setConversasBadge(initialConversasBadge);
  }, [initialConversasBadge]);

  useEffect(() => {
    setNotificacoesBadge(initialNotificacoesBadge);
  }, [initialNotificacoesBadge]);

  // Otimista: assim que o user entra em /app/notificacoes, zera o badge
  // na hora — porque a página marca todas como lidas no server. Sem
  // esse update, o badge ficava preso esperando realtime fire que
  // demora ou não dispara dependendo do device/navegador.
  useEffect(() => {
    if (pathname?.startsWith("/app/notificacoes")) {
      setNotificacoesBadge(0);
    }
  }, [pathname]);

  // Realtime: atualiza badges quando chega coisa nova.
  useEffect(() => {
    async function refresh() {
      const [unreadRes, pedidosRes, notifsRes] = await Promise.all([
        supabase
          .from("mensagens")
          .select("*", { count: "exact", head: true })
          .eq("lido", false)
          .neq("de_id", userId),
        supabase
          .from("pedidos_privado")
          .select("*", { count: "exact", head: true })
          .eq("alvo_id", userId)
          .eq("status", "pendente"),
        supabase
          .from("notificacoes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("lida", false),
      ]);
      setConversasBadge((unreadRes.count ?? 0) + (pedidosRes.count ?? 0));
      setNotificacoesBadge(notifsRes.count ?? 0);
    }

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos_privado" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [supabase, userId]);

  const tabs: Tab[] = [
    {
      href: "/app/descobrir",
      label: "Início",
      matchPrefix: "/app/descobrir",
      icon: <FlameIcon />,
    },
    {
      href: "/app/radar",
      label: "Radar",
      matchPrefix: "/app/radar",
      icon: <RadarIcon />,
    },
    {
      href: "/app/notificacoes",
      label: "Notif",
      matchPrefix: "/app/notificacoes",
      icon: <BellIcon />,
      badge: notificacoesBadge,
    },
    {
      href: "/app/conversas",
      label: "Chat",
      matchPrefix: "/app/conversas",
      icon: <ChatIcon />,
      badge: conversasBadge,
    },
    {
      href: "/app/perfil",
      label: "Você",
      matchPrefix: "/app/perfil",
      icon: <UserIcon />,
    },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-3 pb-4 pt-3"
      style={{
        background:
          "linear-gradient(to top, var(--bg-0) 62%, rgba(10,7,6,0))",
      }}
    >
      <div
        className="flex items-center rounded-full px-1.5 py-2"
        style={{
          background: "rgba(18, 13, 10, 0.85)",
          backdropFilter: "blur(18px)",
          border: "1px solid var(--line)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
        }}
      >
        {tabs.map((t) => {
          const active = pathname?.startsWith(t.matchPrefix) ?? false;
          const hasBadge = (t.badge ?? 0) > 0;
          const content = (
            <span
              className="relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full w-full"
              style={{
                color: active
                  ? "var(--gold-300)"
                  : t.disabled
                    ? "var(--text-3)"
                    : "var(--text-2)",
                background: active
                  ? "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))"
                  : "transparent",
                border: active ? "1px solid var(--gold-600)" : "1px solid transparent",
                opacity: t.disabled ? 0.55 : 1,
                transition: "background 0.2s, color 0.2s",
                paddingLeft: 6,
                paddingRight: 6,
              }}
            >
              {t.icon}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  lineHeight: 1.2,
                }}
              >
                {t.label}
              </span>
              {hasBadge && (
                <span
                  aria-label={`${t.badge} não lidas`}
                  className="absolute flex items-center justify-center"
                  style={{
                    top: 0,
                    right: 6,
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 999,
                    background: "var(--shine-gold)",
                    color: "#1a0f05",
                    fontSize: 10,
                    fontWeight: 800,
                    border: "2px solid rgba(18, 13, 10, 0.95)",
                    boxShadow: "0 2px 10px rgba(212,175,110,0.5)",
                  }}
                >
                  {(t.badge ?? 0) > 99 ? "99+" : t.badge}
                </span>
              )}
            </span>
          );

          if (t.disabled) {
            return (
              <button
                key={t.href}
                type="button"
                title="Em breve"
                aria-disabled="true"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "not-allowed",
                  padding: 0,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                textDecoration: "none",
                flex: 1,
                minWidth: 0,
                display: "block",
              }}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>

      {isAdmin && (
        <div className="mt-2 flex justify-center">
          <Link
            href="/admin/moderacao"
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--gold-400)",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "rgba(212,175,110,0.05)",
            }}
          >
            Admin · Moderação
          </Link>
        </div>
      )}
    </nav>
  );
}

function FlameIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 1.5c-.3 2.6-1.7 4-3.3 5.6C8.4 8.9 6.5 10.8 6.5 14a5.5 5.5 0 1011 0c0-1.3-.5-2.3-1-3.2-.3-.6-.7-1.1-.9-1.7-.3-.9-.2-1.7 0-2.6.2-.8.4-1.7 0-2.5-.5-.9-1.4-1.5-2.1-2.5zm-.1 11.1c.7-.4 1.2-1.2 1.4-2 .2-.7.1-1.4 0-1.9.5.3 1 .8 1.3 1.6.4.9.4 2 .1 2.9a3.2 3.2 0 01-5.5.7c-.8-1.1-.7-2.6.3-3.7.3-.3.6-.6 1-.9-.1.5-.2 1.1-.1 1.7.1.5.4 1.2 1 1.4.2.1.3.2.5.2z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function RadarIcon() {
  // Pino com pulse — sugere localização/radar
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s7-7.5 7-13a7 7 0 10-14 0c0 5.5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
