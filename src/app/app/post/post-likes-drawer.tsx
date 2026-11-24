"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { listPostLikes, type PostLikeItem } from "./likes-actions";

/* ====================================================================
 * PostLikesDrawer — bottom sheet listando quem curtiu o post.
 *  - Carrega via listPostLikes ao abrir
 *  - Cada linha: avatar + nome + cidade + tempo desde curtida
 *  - Click leva pro perfil
 * ================================================================== */

export function PostLikesDrawer({
  postId,
  open,
  onClose,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<PostLikeItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPostLikes(postId)
      .then((r) => {
        if (!cancelled) setItens(r);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  // Trava scroll do body enquanto drawer aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const content = (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 99999, background: "rgba(0,0,0,0.7)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{
          background: "var(--bg-1)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          maxHeight: "75dvh",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center"
          style={{ paddingTop: 8, paddingBottom: 4 }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 999,
              background: "var(--line-strong)",
            }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 18px 12px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <div
              className="display"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-0)",
              }}
            >
              Quem curtiu
            </div>
            <div
              style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
            >
              {loading
                ? "Carregando…"
                : `${itens.length} ${itens.length === 1 ? "pessoa" : "pessoas"}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-2)",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto scroll">
          {error && (
            <div
              role="alert"
              className="m-4 rounded-xl p-3"
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

          {!loading && !error && itens.length === 0 && (
            <div
              className="flex flex-col items-center text-center gap-2"
              style={{ padding: "48px 16px" }}
            >
              <div style={{ fontSize: 32 }}>♡</div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-1)",
                  fontWeight: 500,
                }}
              >
                Ninguém curtiu ainda
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  maxWidth: 240,
                  lineHeight: 1.5,
                }}
              >
                Quando alguém curtir esse post, vai aparecer aqui.
              </div>
            </div>
          )}

          {itens.map((item, i) => (
            <Link
              key={item.profileId}
              href={`/app/p/${item.profileId}`}
              onClick={onClose}
              className="flex items-center gap-3"
              style={{
                padding: "10px 16px",
                borderBottom:
                  i === itens.length - 1 ? "none" : "1px solid var(--line)",
                textDecoration: "none",
              }}
            >
              <div
                className="relative overflow-hidden flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid var(--gold-600)",
                  background: "var(--bg-2)",
                }}
              >
                {item.capa ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.capa}
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
                <div className="flex items-center gap-1.5">
                  <span
                    className="truncate"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-0)",
                    }}
                  >
                    {item.nome}
                  </span>
                  {item.verificado && (
                    <span
                      title="Verificado"
                      style={{ fontSize: 10, color: "var(--gold-300)" }}
                    >
                      ✓
                    </span>
                  )}
                  {item.vip && (
                    <span
                      title="VIP"
                      style={{
                        fontSize: 9,
                        color: "var(--gold-300)",
                        fontWeight: 700,
                      }}
                    >
                      ★
                    </span>
                  )}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
                >
                  {item.idades && `${item.idades} · `}
                  {item.cidade || "Brasil"} · {tempoRelativo(item.curtidoEm)}
                </div>
              </div>
              <span style={{ color: "var(--text-3)", fontSize: 16 }}>›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks}sem`;
  return `há ${Math.floor(days / 30)}m`;
}
