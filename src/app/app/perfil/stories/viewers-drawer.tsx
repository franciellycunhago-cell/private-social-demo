"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  listarViewsDoStory,
  type StoryViewerInfo,
} from "./actions";

/* ====================================================================
 * ViewersDrawer — bottom sheet com quem viu / curtiu o story.
 *
 *  - Fetch lazy: só bate no server quando abre
 *  - Divide em 2 tabs: "Curtidas" | "Visualizações"
 *  - Cada linha: avatar + nome + quando viu + ♥ se curtiu
 * ================================================================== */

export function ViewersDrawer({
  storyId,
  views,
  likes,
  open,
  onClose,
}: {
  storyId: string;
  views: number;
  likes: number;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<StoryViewerInfo[]>([]);
  const [tab, setTab] = useState<"todos" | "curtidas">("todos");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listarViewsDoStory(storyId)
      .then((r) => {
        if (!cancelled) setLista(r);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Não consegui carregar.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storyId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const filtered = tab === "curtidas" ? lista.filter((v) => v.liked) : lista;

  const content = (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
        style={{
          background: "var(--bg-1)",
          borderTop: "1px solid var(--line-strong)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          maxHeight: "80dvh",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Handle */}
        <div className="flex items-center justify-center pt-3">
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-4 pt-4 pb-3">
          <TabButton
            label={`Todos · ${views}`}
            active={tab === "todos"}
            onClick={() => setTab("todos")}
          />
          <TabButton
            label={`♥ Curtidas · ${likes}`}
            active={tab === "curtidas"}
            onClick={() => setTab("curtidas")}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex items-center justify-center"
            style={{
              marginLeft: "auto",
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll" style={{ padding: "0 16px 16px" }}>
          {loading && (
            <div
              className="text-center py-8"
              style={{ color: "var(--text-3)", fontSize: 12 }}
            >
              Carregando…
            </div>
          )}
          {!loading && error && (
            <div
              role="alert"
              className="rounded-xl p-3"
              style={{
                background: "rgba(217,138,114,0.08)",
                border: "1px solid rgba(217,138,114,0.3)",
                color: "var(--rose-400)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div
              className="text-center py-10"
              style={{ color: "var(--text-3)", fontSize: 13 }}
            >
              {tab === "curtidas"
                ? "Ninguém curtiu ainda"
                : "Ninguém viu ainda"}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-0">
              {filtered.map((v, i) => (
                <div
                  key={v.viewerId}
                  className="flex items-center gap-3 py-2.5"
                  style={{
                    borderBottom:
                      i === filtered.length - 1
                        ? "none"
                        : "1px solid var(--line)",
                  }}
                >
                  <div
                    className="relative overflow-hidden flex-shrink-0"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "1px solid var(--gold-600)",
                      background: "var(--bg-2)",
                    }}
                  >
                    {v.capa ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={v.capa}
                        alt=""
                        className="absolute inset-0 w-full h-full"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: "var(--gold-300)", fontSize: 16 }}
                      >
                        ♥
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-0)",
                      }}
                    >
                      {v.nome}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        marginTop: 1,
                      }}
                    >
                      {relativeTime(v.viewedAt)}
                    </div>
                  </div>
                  {v.liked && (
                    <span
                      aria-label="Curtiu"
                      style={{ color: "#ff4c6b", fontSize: 18 }}
                    >
                      ♥
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        background: active
          ? "linear-gradient(135deg, rgba(212,175,110,0.22), rgba(212,175,110,0.06))"
          : "transparent",
        border: active ? "1px solid var(--gold-500)" : "1px solid var(--line)",
        color: active ? "var(--gold-300)" : "var(--text-2)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  return `há ${days}d`;
}
