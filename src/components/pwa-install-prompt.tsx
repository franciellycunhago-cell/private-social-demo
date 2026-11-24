"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-prompt-dismissed";

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Não mostra se já foi dispensado
    if (localStorage.getItem(DISMISS_KEY)) return;
    // Não mostra se já está instalado (display-mode standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function instalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
  }

  function dispensar() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4"
      style={{ bottom: 108 }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, #1e140a, #2a1a0e)",
          border: "1px solid var(--gold-600)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />

        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-0)" }}>
            Instalar PrivateSocial
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}>
            Acesse sem abrir o navegador
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={dispensar}
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px 8px",
            }}
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={instalar}
            className="btn-gold"
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
