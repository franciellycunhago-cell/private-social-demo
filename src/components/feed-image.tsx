"use client";

import { useState } from "react";

/* ====================================================================
 * FeedImage — <img> com retry automático + lazy loading + fallback.
 *
 * Resolve bug "fotos pretas no feed" reportado em 28/04/26: usuários
 * abrem o feed e várias fotos ficam pretas (não carregam). Causa:
 *
 *   1. Feed tem até 15 posts × várias fotos → 45-75 requests em
 *      paralelo. Browser limita ~6 por origem → várias dão timeout.
 *   2. Quando a request falha, sem retry → fica preto até refresh.
 *
 * Fix:
 *   - loading="lazy" → browser carrega só quando próxima da viewport
 *   - decoding="async" → não bloqueia render
 *   - onError com retry (até 2x, com backoff e cache-buster) → derruba
 *     transients sem o user perceber
 *   - Fallback visual depois de falhar permanentemente — em vez de
 *     ficar preto silencioso
 * ================================================================== */

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [600, 1500];

export function FeedImage({
  src,
  alt,
  fit = "contain",
  objectPosition,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
  objectPosition?: string;
  className?: string;
  /** "eager" pra fotos acima da dobra (capa de perfil), "lazy" pro resto */
  loading?: "lazy" | "eager";
}) {
  const [retries, setRetries] = useState(0);
  const [permaErrored, setPermaErrored] = useState(false);

  // Cache-buster pra forçar nova request quando der erro — evita
  // pegar o estado errado da connection-pool do browser.
  const finalSrc =
    retries === 0
      ? src
      : `${src}${src.includes("?") ? "&" : "?"}_r=${retries}`;

  function handleError() {
    if (retries >= MAX_RETRIES) {
      setPermaErrored(true);
      return;
    }
    const delay = RETRY_DELAYS_MS[retries] ?? 2000;
    setTimeout(() => setRetries((r) => r + 1), delay);
  }

  function handleLoad() {
    if (permaErrored) setPermaErrored(false);
  }

  if (permaErrored) {
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${className ?? ""}`.trim()}
        style={{
          background: "var(--bg-2)",
          color: "var(--text-3)",
          fontSize: 11,
          padding: 16,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 24 }}>📷</span>
        <span>Foto não carregou</span>
        <button
          type="button"
          onClick={() => {
            setPermaErrored(false);
            setRetries((r) => r + 1);
          }}
          className="mono"
          style={{
            marginTop: 4,
            background: "transparent",
            border: "1px solid var(--gold-600)",
            color: "var(--gold-300)",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={finalSrc}
      alt={alt}
      className={`no-save absolute inset-0 w-full h-full ${className ?? ""}`.trim()}
      style={{ objectFit: fit, objectPosition }}
      loading={loading}
      decoding="async"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}
