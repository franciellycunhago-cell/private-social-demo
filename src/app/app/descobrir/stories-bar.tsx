"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markStoryViewed, setStoryLike } from "../perfil/stories/actions";
import { WatermarkOverlay } from "@/components/watermarked-photo";
import { makeViewerToken } from "@/lib/watermark-token";

/* ====================================================================
 * StoriesBar — carrossel horizontal no topo de /app/descobrir
 *
 * Recebe stories dos matches (agrupados por autor). Clique abre o
 * viewer fullscreen que passa por todos os stories desse autor com
 * progress bars no topo (estilo Instagram).
 *
 *  - Auto-advance a cada 5s
 *  - Tap lado esquerdo = voltar; direito = avançar
 *  - ESC ou tap no X fecha
 *  - Marca como visto via server action ao entrar em cada story
 * ================================================================== */

// Tipo vive em lib/stories-types (puro, sem imports de server) pra
// poder ser usado tanto por client quanto por server sem puxar
// `supabase/server` pro bundle do cliente.
export type { StoriesBarAutor } from "@/lib/stories-types";
import type { StoriesBarAutor } from "@/lib/stories-types";

const IMG_DURACAO_MS = 5000;
const VIDEO_MAX_MS = 30_000;

export function StoriesBar({
  autores,
  compact = false,
  meId,
}: {
  autores: StoriesBarAutor[];
  compact?: boolean;
  meId?: string;
}) {
  const [viewer, setViewer] = useState<{
    autorIdx: number;
    storyIdx: number;
  } | null>(null);
  const [picker, setPicker] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);

  useEffect(() => {
    setPickerMounted(true);
  }, []);

  // Mesmo sem matches com story ativo, mostramos a seção com o atalho
  // "Publicar" (story ou post) pro user postar direto do /app/descobrir.

  function abrir(autorIdx: number) {
    setViewer({ autorIdx, storyIdx: 0 });
  }

  function fechar() {
    setViewer(null);
  }

  function avancar() {
    if (!viewer) return;
    const autor = autores[viewer.autorIdx]!;
    if (viewer.storyIdx + 1 < autor.stories.length) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx + 1 });
    } else if (viewer.autorIdx + 1 < autores.length) {
      setViewer({ autorIdx: viewer.autorIdx + 1, storyIdx: 0 });
    } else {
      fechar();
    }
  }

  function voltar() {
    if (!viewer) return;
    if (viewer.storyIdx > 0) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx - 1 });
    } else if (viewer.autorIdx > 0) {
      const prev = autores[viewer.autorIdx - 1]!;
      setViewer({
        autorIdx: viewer.autorIdx - 1,
        storyIdx: prev.stories.length - 1,
      });
    }
  }

  return (
    <>
      <section style={{ paddingTop: compact ? 0 : 24 }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
            marginBottom: compact ? 6 : 10,
          }}
        >
          Stories · 24h
        </div>
        <div className="flex gap-3 overflow-x-auto scroll pb-1">
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="flex-shrink-0 text-center"
            style={{
              width: 72,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            aria-label="Publicar"
          >
            <div
              className="relative mx-auto flex items-center justify-center"
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                border: "2px dashed var(--gold-500)",
                background:
                  "linear-gradient(135deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
                color: "var(--gold-300)",
                fontSize: 26,
              }}
            >
              ＋
            </div>
            <div
              className="mt-2 truncate"
              style={{ fontSize: 11, color: "var(--gold-300)" }}
            >
              Publicar
            </div>
          </button>
          {autores.map((a, i) => (
            <button
              key={a.profileId}
              type="button"
              onClick={() => abrir(i)}
              className="flex-shrink-0 text-center"
              style={{
                width: 72,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`Ver stories de ${a.nome}`}
            >
              <div
                className="relative mx-auto"
                style={{
                  width: 68,
                  height: 68,
                  padding: 2,
                  borderRadius: "50%",
                  background: a.temNaoVisto
                    ? "conic-gradient(var(--gold-300), var(--gold-600), var(--gold-300))"
                    : "rgba(212,175,110,0.15)",
                }}
              >
                {a.checkin && (
                  <span
                    aria-label={`Está em ${a.checkin.titulo}`}
                    title={a.checkin.titulo}
                    className="absolute"
                    style={{
                      bottom: -2,
                      right: -2,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--shine-gold)",
                      border: "2px solid var(--bg-0)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      lineHeight: 1,
                      zIndex: 2,
                      boxShadow: "0 2px 8px rgba(212,175,110,0.5)",
                    }}
                  >
                    📍
                  </span>
                )}
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    border: "3px solid var(--bg-0)",
                    background: "var(--bg-2)",
                  }}
                >
                  {a.capa ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.capa}
                      alt=""
                      className="no-save absolute inset-0 w-full h-full"
                      style={{ objectFit: "cover" }}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ color: "var(--gold-300)", fontSize: 22 }}
                    >
                      ♥
                    </div>
                  )}
                </div>
              </div>
              <div
                className="mt-2 truncate"
                style={{ fontSize: 11, color: "var(--text-1)" }}
              >
                {meId && a.profileId === meId ? "Você" : firstName(a.nome)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {viewer && (
        <StoryViewer
          autor={autores[viewer.autorIdx]!}
          storyIdx={viewer.storyIdx}
          meuToken={meId ? makeViewerToken(meId) : ""}
          onClose={fechar}
          onNext={avancar}
          onPrev={voltar}
        />
      )}

      {picker && pickerMounted && createPortal(
        <div
          onClick={() => setPicker(false)}
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999, background: "rgba(0,0,0,0.65)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md flex flex-col"
            style={{
              background: "var(--bg-1)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: "12px 14px calc(env(safe-area-inset-bottom) + 14px)",
              gap: 8,
            }}
          >
            <div
              className="mx-auto"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "var(--line-strong)",
                marginBottom: 6,
              }}
            />
            <div
              className="mono mx-auto mb-1"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-3)",
              }}
            >
              O que você quer publicar?
            </div>
            <Link
              href="/app/perfil/stories"
              onClick={() => setPicker(false)}
              className="flex items-center gap-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "14px 16px",
                color: "var(--text-0)",
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 22 }}>⚡</span>
              <div className="flex flex-col">
                <span>Story</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  Some em 24h. Foto ou vídeo.
                </span>
              </div>
            </Link>
            <Link
              href="/app/post/novo"
              onClick={() => setPicker(false)}
              className="flex items-center gap-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "14px 16px",
                color: "var(--text-0)",
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 22 }}>📝</span>
              <div className="flex flex-col">
                <span>Post no feed</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  Permanente. Até 10 fotos + texto.
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setPicker(false)}
              className="mono"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-3)",
                padding: "10px 0 4px",
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function StoryViewer({
  autor,
  storyIdx,
  meuToken,
  onClose,
  onNext,
  onPrev,
}: {
  autor: StoriesBarAutor;
  storyIdx: number;
  meuToken: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const story = autor.stories[storyIdx]!;
  const isVideo = story.mediaTipo === "video";
  const [pausado, setPausado] = useState(false);
  const startRef = useRef<number>(Date.now());
  const elapsedBefore = useRef(0);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(story.liked);
  const [videoCarregando, setVideoCarregando] = useState(
    story.mediaTipo === "video",
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);

  // Bounding box da área REAL ocupada pelo conteúdo (sem as barras
  // pretas que sobram quando o aspect ratio do video/img difere do
  // container). Usado pra colocar a watermark só em cima do conteúdo,
  // não nas barras pretas — fica mais limpo visualmente.
  const [mediaBox, setMediaBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const recalcMediaBox = useCallback(() => {
    const container = mediaContainerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    let nw = 0;
    let nh = 0;
    if (isVideo) {
      const v = videoRef.current;
      nw = v?.videoWidth ?? 0;
      nh = v?.videoHeight ?? 0;
    } else {
      const i = imgRef.current;
      nw = i?.naturalWidth ?? 0;
      nh = i?.naturalHeight ?? 0;
    }
    if (!nw || !nh) return;

    const ratio = nw / nh;
    const cRatio = cw / ch;
    let w: number;
    let h: number;
    if (ratio > cRatio) {
      w = cw;
      h = cw / ratio;
    } else {
      h = ch;
      w = ch * ratio;
    }
    setMediaBox({
      left: (cw - w) / 2,
      top: (ch - h) / 2,
      width: w,
      height: h,
    });
  }, [isVideo]);

  // Recalcula no resize + reset quando muda de story
  useEffect(() => {
    setMediaBox(null);
    recalcMediaBox();
    const onResize = () => recalcMediaBox();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [story.id, recalcMediaBox]);

  // Reseta liked quando muda de story
  useEffect(() => {
    setLiked(story.liked);
    setVideoCarregando(story.mediaTipo === "video");
  }, [story.id, story.liked, story.mediaTipo]);

  const storyId = story.id;
  const duracaoMs = isVideo
    ? Math.min(VIDEO_MAX_MS, story.duracaoMs ?? VIDEO_MAX_MS)
    : IMG_DURACAO_MS;

  // Marca como visto
  useEffect(() => {
    void markStoryViewed(storyId);
  }, [storyId]);

  // Controle de vídeo (play/pause sincronizado com estado pausado)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {
      /* autoplay bloqueado: mostra o botão nativo */
    });
  }, [storyId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (pausado) v.pause();
    else void v.play().catch(() => {});
  }, [pausado]);

  // Progress + auto-advance
  useEffect(() => {
    startRef.current = Date.now();
    elapsedBefore.current = 0;
    setProgress(0);

    let raf = 0;
    function tick() {
      if (pausado) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed =
        elapsedBefore.current + (Date.now() - startRef.current);
      const pct = Math.min(1, elapsed / duracaoMs);
      setProgress(pct);
      if (pct >= 1) {
        onNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [storyId, onNext, pausado, duracaoMs]);

  // Pause quando segura; resume quando solta
  useEffect(() => {
    if (pausado) {
      elapsedBefore.current += Date.now() - startRef.current;
    } else {
      startRef.current = Date.now();
    }
  }, [pausado]);

  // Esc fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Trava scroll do body enquanto o viewer está aberto
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background: "#000",
        zIndex: 9999,
        // Fullscreen real: usa 100dvh (dynamic viewport) pra cobrir até
        // debaixo da barra do navegador mobile
        height: "100dvh",
        width: "100vw",
      }}
    >
      {/* Progress bars */}
      <div
        className="flex gap-1 px-3"
        style={{
          paddingTop: "max(14px, env(safe-area-inset-top))",
        }}
      >
        {autor.stories.map((s, i) => (
          <div
            key={s.id}
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 3, background: "rgba(255,255,255,0.25)" }}
          >
            <div
              style={{
                width:
                  i < storyIdx
                    ? "100%"
                    : i === storyIdx
                      ? `${Math.round(progress * 100)}%`
                      : "0%",
                height: "100%",
                background: "#fff",
                transition:
                  i === storyIdx ? "none" : "width 0.2s",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-3"
        style={{ color: "#fff" }}
      >
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          {autor.capa && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={autor.capa}
              alt=""
              className="no-save absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{autor.nome}</div>
          <div
            className="flex items-center gap-2 flex-wrap"
            style={{ fontSize: 11, opacity: 0.7 }}
          >
            <span>{relativeTime(story.createdAt)}</span>
            {story.evento && (
              <Link
                href={`/app/eventos/${story.evento.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mono"
                style={{
                  background: "rgba(212,175,110,0.15)",
                  border: "1px solid var(--gold-500)",
                  color: "var(--gold-300)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: 0.5,
                  textDecoration: "none",
                  opacity: 1,
                  maxWidth: 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                }}
              >
                📍 {story.evento.titulo}
              </Link>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
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
      </div>

      {/* Imagem */}
      <div
        ref={mediaContainerRef}
        className="relative flex-1 flex items-center justify-center"
        style={{ overflow: "hidden" }}
        onPointerDown={() => setPausado(true)}
        onPointerUp={() => setPausado(false)}
        onPointerLeave={() => setPausado(false)}
      >
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={story.mediaUrl}
              className="no-save max-w-full max-h-full"
              style={{
                objectFit: "contain",
                userSelect: "none",
                WebkitTouchCallout: "none",
              }}
              playsInline
              autoPlay
              loop={false}
              preload="auto"
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              onLoadedMetadata={recalcMediaBox}
              onWaiting={() => setVideoCarregando(true)}
              onPlaying={() => setVideoCarregando(false)}
              onCanPlay={() => setVideoCarregando(false)}
            />
            {videoCarregando && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ color: "#fff" }}
              >
                <div
                  aria-label="Carregando vídeo"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.18)",
                    borderTopColor: "var(--gold-300)",
                    animation: "story-spin 0.8s linear infinite",
                  }}
                />
              </div>
            )}
            <style jsx>{`
              @keyframes story-spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            src={story.mediaUrl}
            alt=""
            className="no-save max-w-full max-h-full"
            style={{
              objectFit: "contain",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            onLoad={recalcMediaBox}
          />
        )}

        {/* Watermark de rastreamento — TC do user logado, posicionada
         *  só na área REAL do conteúdo (sem as barras pretas dos lados
         *  quando o aspect ratio difere). Mais limpo visualmente. */}
        {meuToken && mediaBox && (
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: mediaBox.left,
              top: mediaBox.top,
              width: mediaBox.width,
              height: mediaBox.height,
              overflow: "hidden",
            }}
          >
            <WatermarkOverlay label={meuToken} intensity="subtle" />
          </div>
        )}

        {/* Tap areas */}
        <button
          type="button"
          onClick={onPrev}
          aria-label="Voltar"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "35%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        />
        <button
          type="button"
          onClick={onNext}
          aria-label="Avançar"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "35%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        />

      </div>

      {/* Botão de curtir — fora das tap-areas pra não conflitar */}
      <button
        type="button"
        onClick={() => {
          const novo = !liked;
          setLiked(novo);
          void setStoryLike(storyId, novo);
        }}
        aria-label={liked ? "Descurtir story" : "Curtir story"}
        className="flex items-center justify-center"
        style={{
          position: "absolute",
          right: 14,
          bottom: `calc(env(safe-area-inset-bottom) + 68px)`,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: liked ? "#ff4c6b" : "#fff",
          cursor: "pointer",
          fontSize: 22,
          zIndex: 2,
          transform: liked ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.15s, color 0.15s",
          boxShadow: liked
            ? "0 6px 24px rgba(255,76,107,0.4)"
            : "0 4px 14px rgba(0,0,0,0.45)",
        }}
      >
        {liked ? "♥" : "♡"}
      </button>

      {/* Legenda em tarja full-width, fixa no rodapé */}
      {story.texto && (
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
          {story.texto}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

function firstName(nome: string): string {
  return nome.split(/[\s&]/)[0] ?? nome;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h`;
}
