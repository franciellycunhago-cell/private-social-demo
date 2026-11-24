"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteStory } from "./actions";
import { ViewersDrawer } from "./viewers-drawer";

/* ====================================================================
 * StoryCard — card pequeno com preview, contador de horas, apagar.
 *  - Tocar no card abre o preview fullscreen (igual ao viewer do feed)
 *  - Botão "olho" abre o ViewersDrawer com lista de quem viu/curtiu
 *  - Botão lixeira apaga
 * ================================================================== */

export function StoryCard({
  storyId,
  mediaUrl,
  mediaTipo,
  texto,
  createdAt,
  expiresAt,
  views,
  likes,
  evento,
}: {
  storyId: string;
  mediaUrl: string | null;
  mediaTipo: "imagem" | "video";
  texto: string | null;
  createdAt: string;
  expiresAt: string;
  views: number;
  likes: number;
  evento?: { id: string; titulo: string } | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [restante, setRestante] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [previewOpen]);

  useEffect(() => {
    const id = setInterval(() => {
      setRestante(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 60000);
    return () => clearInterval(id);
  }, [expiresAt]);

  function apagar() {
    if (!confirm("Apagar esse story?")) return;
    startTransition(async () => {
      const result = await deleteStory(storyId);
      if ("error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  const horasRestantes = Math.max(1, Math.round(restante / (60 * 60 * 1000)));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setPreviewOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPreviewOpen(true);
        }
      }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "4/5",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        opacity: pending ? 0.55 : 1,
        cursor: "pointer",
      }}
    >
      {mediaUrl ? (
        mediaTipo === "video" ? (
          <video
            src={mediaUrl}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mediaUrl}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        )
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: "var(--text-3)", fontSize: 11 }}
        >
          carregando…
        </div>
      )}
      {mediaTipo === "video" && (
        <div
          className="absolute"
          style={{
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 10,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          ▶ vídeo
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 55%, rgba(10,7,6,0.75))",
        }}
      />

      <div
        className="absolute flex items-center"
        style={{
          top: 8,
          left: 8,
          right: 8,
          gap: 4,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            color: "var(--gold-300)",
            border: "1px solid var(--line-strong)",
            letterSpacing: 1,
          }}
        >
          {horasRestantes}h
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            apagar();
          }}
          disabled={pending}
          aria-label="Apagar"
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            cursor: pending ? "wait" : "pointer",
            fontSize: 12,
          }}
        >
          🗑
        </button>
      </div>

      {/* Badge de evento marcado */}
      {evento && (
        <div
          className="absolute mono"
          style={{
            bottom: 32,
            left: 8,
            right: 8,
            background: "rgba(212,175,110,0.92)",
            color: "#1a0f05",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: 0.5,
            fontWeight: 700,
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(212,175,110,0.4)",
          }}
        >
          📍 {evento.titulo}
        </div>
      )}

      {/* Tarja com legenda (sempre full-width quando tem texto) */}
      {texto && (
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: 24,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            padding: "7px 10px",
            fontSize: 11,
            lineHeight: 1.3,
            fontWeight: 500,
            textAlign: "center",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {texto}
        </div>
      )}

      <div
        className="absolute flex items-center justify-between"
        style={{
          left: 10,
          right: 10,
          bottom: 6,
          color: "#fff",
          fontSize: 10,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.85)" }}>
          {relativeTime(createdAt)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDrawerOpen(true);
          }}
          aria-label="Ver quem viu e curtiu"
          className="mono flex items-center gap-1.5"
          style={{
            color: "var(--gold-300)",
            letterSpacing: 0.5,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "3px 7px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          <span>👁 {views}</span>
          {likes > 0 && (
            <span style={{ color: "#ff4c6b" }}>♥ {likes}</span>
          )}
        </button>
      </div>

      <ViewersDrawer
        storyId={storyId}
        views={views}
        likes={likes}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {previewOpen && mounted && mediaUrl && createPortal(
        <div
          onClick={() => setPreviewOpen(false)}
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 99999, background: "#000" }}
        >
          {mediaTipo === "video" ? (
            <video
              src={mediaUrl}
              className="max-w-full max-h-full"
              style={{ objectFit: "contain" }}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mediaUrl}
              alt=""
              className="max-w-full max-h-full"
              style={{ objectFit: "contain" }}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {evento && (
            <Link
              href={`/app/eventos/${evento.id}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute mono"
              style={{
                top: `max(14px, env(safe-area-inset-top))`,
                left: 14,
                background: "var(--shine-gold)",
                color: "#1a0f05",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: 0.5,
                fontWeight: 700,
                textDecoration: "none",
                maxWidth: "60%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                boxShadow: "0 6px 18px rgba(212,175,110,0.4)",
              }}
            >
              📍 {evento.titulo}
            </Link>
          )}
          {texto && (
            <div
              className="absolute left-0 right-0"
              style={{
                bottom: 0,
                background: "rgba(0,0,0,0.78)",
                backdropFilter: "blur(10px)",
                color: "#fff",
                padding: `14px 18px calc(env(safe-area-inset-bottom) + 14px)`,
                fontSize: 14,
                lineHeight: 1.4,
                fontWeight: 500,
                textAlign: "center",
                pointerEvents: "none",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {texto}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(false);
            }}
            aria-label="Fechar"
            className="absolute flex items-center justify-center"
            style={{
              top: `max(14px, env(safe-area-inset-top))`,
              right: 14,
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h`;
}
