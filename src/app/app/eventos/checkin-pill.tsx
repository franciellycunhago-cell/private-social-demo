"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInEvento, checkOutEvento } from "@/lib/checkins/actions";

/* ====================================================================
 * CheckinPill — botão "Estou aqui" / "✓ no local" pra evento.
 *  - Click insere/remove em checkins (12h)
 *  - Otimista local, refresh ao concluir
 * ================================================================== */

export function CheckinPill({
  eventoId,
  jaCheckedIn,
}: {
  eventoId: string;
  jaCheckedIn: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(jaCheckedIn);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    setError(null);
    const novo = !local;
    setLocal(novo);
    startTransition(async () => {
      const r = novo
        ? await checkInEvento(eventoId)
        : await checkOutEvento(eventoId);
      if ("error" in r) {
        setError(r.error);
        setLocal(!novo);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="mono"
        style={{
          background: local
            ? "rgba(212,175,110,0.15)"
            : "var(--shine-gold)",
          color: local ? "var(--gold-300)" : "#1a0f05",
          border: local ? "1px solid var(--gold-500)" : "none",
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {local ? "✓ Estou aqui" : "📍 Estou aqui"}
      </button>
      {error && (
        <div
          role="alert"
          style={{ fontSize: 11, color: "var(--rose-400)", marginTop: 4 }}
        >
          {error}
        </div>
      )}
    </>
  );
}
