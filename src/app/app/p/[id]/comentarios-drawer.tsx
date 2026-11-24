"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  deleteComentario,
  listComentarios,
  postComentario,
  toggleComentarioLike,
  type ComentarioItem,
} from "./comentarios-actions";
import { ContainedPhotoWithWatermark } from "@/components/watermarked-photo";

/* ====================================================================
 * ComentariosDrawer — modal com foto no topo + comentários abaixo.
 *
 *  - Foto exibida em retângulo (não tela cheia)
 *  - Lista de comentários scrollável abaixo da foto
 *  - Input fixo no rodapé (enter envia)
 *  - Curtir e apagar em cada comentário
 * ================================================================== */

export function ComentariosDrawer({
  fotoId,
  fotoPreview,
  open,
  onClose,
  watermarkLabel,
}: {
  fotoId: string;
  fotoPreview: string | null;
  open: boolean;
  onClose: () => void;
  /** Token de rastreamento — se passado, renderiza overlay sobre a foto. */
  watermarkLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<ComentarioItem[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, startPosting] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listComentarios(fotoId)
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

  function enviar() {
    const clean = draft.trim();
    if (!clean) return;
    setError(null);
    const temp: ComentarioItem = {
      id: `tmp-${Date.now()}`,
      fotoId,
      texto: clean,
      createdAt: new Date().toISOString(),
      autor: { id: "", nome: "Você", capa: null },
      likes: 0,
      curtiPorMim: false,
      podeApagar: true,
    };
    setItens((atual) => [...atual, temp]);
    setDraft("");

    startPosting(async () => {
      const result = await postComentario(fotoId, clean);
      if ("error" in result) {
        setError(result.error);
        setItens((atual) => atual.filter((c) => c.id !== temp.id));
      } else {
        const r = await listComentarios(fotoId);
        setItens(r);
      }
    });
  }

  function apagar(id: string) {
    if (!confirm("Apagar esse comentário?")) return;
    const snapshot = itens;
    setItens(itens.filter((c) => c.id !== id));
    void deleteComentario(id).then((result) => {
      if ("error" in result) {
        setError(result.error);
        setItens(snapshot);
      }
    });
  }

  function curtir(c: ComentarioItem) {
    const novo = !c.curtiPorMim;
    setItens((atual) =>
      atual.map((x) =>
        x.id === c.id
          ? { ...x, curtiPorMim: novo, likes: x.likes + (novo ? 1 : -1) }
          : x,
      ),
    );
    void toggleComentarioLike(c.id, novo).then((r) => {
      if ("error" in r) {
        setItens((atual) =>
          atual.map((x) =>
            x.id === c.id
              ? { ...x, curtiPorMim: !novo, likes: x.likes + (novo ? -1 : 1) }
              : x,
          ),
        );
      }
    });
  }

  const content = (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 99999, background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{
          background: "var(--bg-1)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          height: "92dvh",
          overflow: "hidden",
        }}
      >
        {/* Foto em retângulo no topo (maior pra ver melhor; comentários
            scrollam abaixo). Privada usa ContainedPhotoWithWatermark
            que aplica overlay só na área real da img (não nas
            laterais pretas). Pública usa <img> simples. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            flexShrink: 0,
            height: "min(440px, 55vh)",
            background: "#000",
            overflow: "hidden",
          }}
        >
          {fotoPreview && watermarkLabel && (
            <ContainedPhotoWithWatermark
              src={fotoPreview}
              alt=""
              label={watermarkLabel}
              intensity="subtle"
              style={{ position: "absolute", inset: 0 }}
            />
          )}
          {fotoPreview && !watermarkLabel && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fotoPreview}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className="no-save"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                userSelect: "none",
                WebkitTouchCallout: "none",
              }}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Cabeçalho comentários */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div
            className="display"
            style={{ fontSize: 15, fontWeight: 500, color: "var(--text-0)" }}
          >
            Comentários
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            {loading
              ? "carregando…"
              : itens.length === 1
                ? "1 comentário"
                : `${itens.length} comentários`}
          </div>
        </div>

        {/* Lista scrollável */}
        <div className="flex-1 overflow-y-auto scroll" style={{ padding: "0 16px" }}>
          {!loading && itens.length === 0 && (
            <div
              className="text-center py-10"
              style={{ color: "var(--text-3)", fontSize: 13 }}
            >
              Seja o primeiro a comentar.
            </div>
          )}
          {itens.map((c) => (
            <ComentarioRow
              key={c.id}
              c={c}
              onCurtir={() => curtir(c)}
              onApagar={() => apagar(c.id)}
            />
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 rounded-xl p-2.5"
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

        {/* Input */}
        <div
          style={{
            padding: "10px 14px calc(env(safe-area-inset-bottom) + 10px)",
            borderTop: "1px solid var(--line)",
            background: "var(--bg-1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            className="flex-1 flex items-center"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder="Comente (até 280)…"
              maxLength={280}
              disabled={posting}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-0)",
                fontSize: 14,
                fontFamily: "var(--font-ui)",
              }}
            />
          </div>
          <button
            type="button"
            onClick={enviar}
            disabled={posting || !draft.trim()}
            aria-label="Enviar"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: draft.trim() ? "var(--shine-gold)" : "rgba(255,255,255,0.06)",
              border: "none",
              cursor: draft.trim() ? "pointer" : "not-allowed",
              color: draft.trim() ? "#1a0f05" : "var(--text-3)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function ComentarioRow({
  c,
  onCurtir,
  onApagar,
}: {
  c: ComentarioItem;
  onCurtir: () => void;
  onApagar: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2.5"
      style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
    >
      <Link
        href={c.autor.id ? `/app/p/${c.autor.id}` : "#"}
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
          textDecoration: "none",
        }}
        aria-label={c.autor.nome}
      >
        {c.autor.capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.autor.capa}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--gold-300)", fontSize: 14 }}
          >
            ♥
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-0)" }}>
            {c.autor.nome}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
            {relativeTime(c.createdAt)}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            marginTop: 2,
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {c.texto}
        </div>
        <div className="flex items-center gap-3 mt-1.5" style={{ fontSize: 11 }}>
          <button
            type="button"
            onClick={onCurtir}
            aria-label={c.curtiPorMim ? "Descurtir" : "Curtir"}
            className="flex items-center gap-1"
            style={{
              background: "transparent",
              border: "none",
              color: c.curtiPorMim ? "#ff4c6b" : "var(--text-3)",
              cursor: "pointer",
              padding: 0,
              fontSize: 12,
            }}
          >
            <span>{c.curtiPorMim ? "♥" : "♡"}</span>
            {c.likes > 0 && <span>{c.likes}</span>}
          </button>
          {c.podeApagar && (
            <button
              type="button"
              onClick={onApagar}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-3)",
                cursor: "pointer",
                padding: 0,
                fontSize: 10,
                textDecoration: "underline",
              }}
            >
              apagar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  return `${days}d`;
}
