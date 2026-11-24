"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { loadPhotoLikers } from "./actions";

/* ====================================================================
 * PhotoLikesDrawer — bottom sheet listando quem curtiu uma foto.
 *
 * Mesmo padrão do PostLikesDrawer (post-likes-drawer.tsx). Carrega
 * a lista de curtidores ao abrir e leva pro perfil ao clicar.
 * ================================================================== */

type Liker = {
  id: string;
  nome: string;
  handle: string | null;
  capa: string | null;
  verificado: boolean;
  vip: boolean;
};

export function PhotoLikesDrawer({
  fotoId,
  open,
  onClose,
}: {
  fotoId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<Liker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !fotoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadPhotoLikers(fotoId)
      .then((r) => {
        if (cancelled) return;
        if ("error" in r) setError(r.error);
        else setItens(r.likers);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fotoId]);

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
            </div>
          )}

          {itens.map((item, i) => (
            <Link
              key={item.id}
              href={`/app/p/${item.id}`}
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
                {item.handle && (
                  <div
                    className="truncate mono"
                    style={{
                      fontSize: 11,
                      color: "var(--gold-300)",
                      marginTop: 1,
                      letterSpacing: 0.5,
                    }}
                  >
                    @{item.handle}
                  </div>
                )}
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
