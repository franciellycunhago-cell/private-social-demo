"use client";

import { useState } from "react";

/* ====================================================================
 * MeuTokenCard — card no /app/perfil que mostra o TC-XXXXXX do user
 * com botões pra copiar e compartilhar.
 *
 * Token = primeiros 6 chars hex do UUID em uppercase (ver
 * lib/watermark-token). Determinístico — mesmo user gera sempre
 * o mesmo token.
 *
 * Compartilhar: gera a IMAGEM via /api/token-imagem e usa Web Share
 * API com `files` (no celular abre o picker nativo com a imagem
 * pronta). Fallback: baixa a imagem + copia mensagem.
 * ================================================================== */

export function MeuTokenCard({
  token,
  nome,
}: {
  token: string;
  nome: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  const buscarUrl = (() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://example.com";
    return `${origin}/app/buscar?q=${token}`;
  })();

  function copiar() {
    navigator.clipboard.writeText(token).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    });
  }

  async function compartilhar() {
    const text = `Me acha no PrivateSocial: ${token}`;
    setGerando(true);

    try {
      // Tenta buscar a imagem gerada e compartilhar junto
      const imgUrl = `/api/token-imagem?token=${encodeURIComponent(
        token,
      )}&nome=${encodeURIComponent(nome)}`;
      const response = await fetch(imgUrl);

      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], `privatesocial-${token}.png`, {
          type: "image/png",
        });

        // Web Share API com arquivo (mobile suporta, desktop não)
        const navWithCanShare = navigator as Navigator & {
          canShare?: (data: { files: File[] }) => boolean;
        };
        const podeShareFile =
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function" &&
          (typeof navWithCanShare.canShare !== "function" ||
            navWithCanShare.canShare({ files: [file] }));

        if (podeShareFile) {
          try {
            await navigator.share({
              files: [file],
              title: `${nome} no PrivateSocial`,
              text,
              url: buscarUrl,
            });
            return;
          } catch {
            // user cancelou — cai no fallback de download
          }
        }

        // Fallback desktop: baixa a imagem e copia mensagem
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `privatesocial-${token}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);

        await navigator.clipboard.writeText(`${text}\n${buscarUrl}`);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 2500);
        return;
      }
    } catch {
      // Falha ao buscar imagem — segue pro fallback texto puro
    } finally {
      setGerando(false);
    }

    // Fallback se imagem falhar: compartilha só texto/link
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${nome} no PrivateSocial`,
          text,
          url: buscarUrl,
        });
      } catch {
        await navigator.clipboard.writeText(`${text}\n${buscarUrl}`);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1800);
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${buscarUrl}`);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    }
  }

  return (
    <div
      className="rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
        border: "1px solid var(--gold-500)",
        padding: 14,
      }}
    >
      <div
        className="mono mb-2"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--gold-300)",
          fontWeight: 700,
        }}
      >
        🎫 Meu token
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          className="mono"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gold-300)",
            letterSpacing: 1.5,
          }}
        >
          {token}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar token"
            className="mono"
            style={{
              background: copiado
                ? "rgba(149,176,115,0.15)"
                : "transparent",
              border: copiado
                ? "1px solid rgba(149,176,115,0.5)"
                : "1px solid var(--gold-600)",
              color: copiado ? "oklch(0.82 0.09 140)" : "var(--gold-300)",
              padding: "6px 11px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copiado ? "✓" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={compartilhar}
            disabled={gerando}
            aria-label="Compartilhar com imagem"
            title="Gera uma imagem com seu token e abre o compartilhador"
            className="mono"
            style={{
              background: "var(--shine-gold)",
              border: "none",
              color: "#1a0f05",
              padding: "6px 11px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontWeight: 800,
              cursor: gerando ? "wait" : "pointer",
              opacity: gerando ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ShareIcon /> {gerando ? "Gerando…" : "Compartilhar"}
          </button>
        </div>
      </div>

      <p
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          marginTop: 8,
          lineHeight: 1.55,
        }}
      >
        Compartilhar gera uma imagem dourada com seu token pra postar
        nas redes. Outros membros colam o código em{" "}
        <strong>Buscar</strong> pra te achar.
      </p>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
