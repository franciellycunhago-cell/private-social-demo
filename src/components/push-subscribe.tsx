"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const DISMISSED_KEY = "push-prompt-dismissed";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe() {
  const reg = await navigator.serviceWorker.ready;
  // Sempre recria a subscription pra garantir que usa a VAPID key correta
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
  });
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

export function PushSubscribe() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    if (Notification.permission === "granted") {
      // Já tem permissão — subscribe silenciosamente
      navigator.serviceWorker.ready.then(() => subscribe()).catch(() => {});
      return;
    }

    if (Notification.permission === "denied") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Mostra prompt depois de 8s pra não assustar na entrada
    const t = setTimeout(() => setShowPrompt(true), 8000);
    return () => clearTimeout(t);
  }, []);

  async function ativar() {
    setShowPrompt(false);
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      await subscribe().catch(() => {});
    } else {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
  }

  function dispensar() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShowPrompt(false);
  }

  if (!showPrompt) return null;

  return (
    <div
      className="fixed left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4"
      style={{ bottom: 108 }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "linear-gradient(135deg, #1a120a, #2a1a0e)",
          border: "1px solid var(--gold-600)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "var(--shine-gold)",
            fontSize: 20,
          }}
        >
          🔔
        </div>

        <div className="flex-1 min-w-0">
          <div
            style={{ fontSize: 13, fontWeight: 700, color: "var(--text-0)" }}
          >
            Ativar notificações
          </div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}>
            Saiba quando der match ou chegar mensagem
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
            Depois
          </button>
          <button
            type="button"
            onClick={ativar}
            className="btn-gold"
            style={{ fontSize: 12, padding: "7px 14px" }}
          >
            Ativar
          </button>
        </div>
      </div>
    </div>
  );
}
