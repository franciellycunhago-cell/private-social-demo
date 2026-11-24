"use client";

import { useEffect, useState } from "react";

/* ====================================================================
 * InstallAppButton — botão "Baixar app" na tela de login.
 *
 * Comportamento por plataforma:
 *  - Android/Chrome/Edge: dispara o prompt nativo (beforeinstallprompt)
 *  - iOS/Safari: abre modal com instruções (Compartilhar → Adicionar à
 *    Tela de Início). iOS não suporta prompt programático.
 *  - Desktop/já-instalado/standalone: esconde o botão.
 * ================================================================== */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Já instalado / rodando como app?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsStandalone(standalone);

    // iOS?
    const ua = window.navigator.userAgent;
    const ios =
      /iphone|ipad|ipod/i.test(ua) &&
      !/(macintosh|windows|android)/i.test(ua);
    setIsIOS(ios);

    // Captura o prompt do Chrome/Android pra disparar depois
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Quando o app é instalado, esconde o botão
    function onAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function onClick() {
    // 1. Se temos prompt nativo (Android/Chrome com engagement), usa ele
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }
    // 2. Caso contrário (iOS, desktop sem prompt ainda, etc.), abre modal
    //    com instruções visuais. iOS detecta automático no modal.
    setShowIOSModal(true);
  }

  // Esconde só se já estiver instalado / rodando como app
  if (isStandalone) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-center gap-2 w-full"
        style={{
          padding: "12px 16px",
          borderRadius: 14,
          background: "rgba(212,175,110,0.08)",
          border: "1px solid var(--gold-600)",
          color: "var(--gold-300)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: 0.2,
        }}
      >
        <DownloadIcon />
        Baixar app no celular
      </button>

      {showIOSModal && (
        <InstallInstructionsModal
          isIOS={isIOS}
          onClose={() => setShowIOSModal(false)}
        />
      )}
    </>
  );
}

function DownloadIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function InstallInstructionsModal({
  isIOS,
  onClose,
}: {
  isIOS: boolean;
  onClose: () => void;
}) {
  const titulo = isIOS ? "Instalar no iPhone" : "Instalar o app";
  const subtitulo = isIOS
    ? "Em 2 passos rápidos no Safari:"
    : "Em 2 passos rápidos:";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
          width: "100%",
          background: "var(--bg-1)",
          border: "1px solid var(--gold-600)",
          borderRadius: 18,
          padding: 24,
          color: "var(--text-0)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="display"
          style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          {titulo}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {subtitulo}
        </div>

        <ol
          style={{
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingLeft: 0,
            listStyle: "none",
          }}
        >
          {isIOS ? (
            <>
              <Passo
                n={1}
                texto={
                  <>
                    Toque no ícone <ShareIOS /> <strong>Compartilhar</strong>{" "}
                    na barra inferior do Safari
                  </>
                }
              />
              <Passo
                n={2}
                texto={
                  <>
                    Role e toque em{" "}
                    <strong>"Adicionar à Tela de Início"</strong>{" "}
                    <PlusBox />
                  </>
                }
              />
            </>
          ) : (
            <>
              <Passo
                n={1}
                texto={
                  <>
                    Toque nos <strong>3 pontinhos</strong> ⋮ no canto superior
                    direito do navegador
                  </>
                }
              />
              <Passo
                n={2}
                texto={
                  <>
                    Toque em{" "}
                    <strong>"Instalar app"</strong> ou{" "}
                    <strong>"Adicionar à tela inicial"</strong>
                  </>
                }
              />
            </>
          )}
        </ol>

        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: "var(--text-3)",
            lineHeight: 1.5,
          }}
        >
          Pronto — o app vai aparecer na sua tela como qualquer outro
          aplicativo. Sem precisar passar pela loja.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-gold w-full"
          style={{ marginTop: 20, padding: 12 }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

function Passo({ n, texto }: { n: number; texto: React.ReactNode }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        color: "var(--text-1)",
        lineHeight: 1.45,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--shine-gold)",
          color: "#1a0f05",
          fontSize: 12,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </div>
      <div>{texto}</div>
    </li>
  );
}

function ShareIOS() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-300)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ verticalAlign: "middle" }}
      aria-hidden
    >
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function PlusBox() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 4,
        border: "1px solid var(--gold-500)",
        color: "var(--gold-300)",
        fontSize: 12,
        fontWeight: 700,
        verticalAlign: "middle",
        marginLeft: 4,
      }}
    >
      +
    </span>
  );
}
