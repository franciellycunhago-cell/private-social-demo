"use client";

import { useState, useTransition } from "react";
import { confirmarPresenca, cancelarPresenca } from "./actions";

/* ====================================================================
 * PresencaButton — botão cliente que toggle confirmação.
 *
 *  - Recebe confirmado inicial e o id do evento
 *  - Optimistic toggle; rollback se o server falhar
 * ================================================================== */

type Props = {
  eventoId: string;
  confirmado: boolean;
  size?: "pill" | "small";
  label?: {
    confirmar?: string;
    confirmado?: string;
  };
};

export function PresencaButton({ eventoId, confirmado, size = "pill", label }: Props) {
  const [local, setLocal] = useState(confirmado);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const textConfirmar = label?.confirmar ?? "Confirmar";
  const textConfirmado = label?.confirmado ?? "Confirmado ✓";

  function toggle() {
    setError(null);
    const next = !local;
    setLocal(next);
    startTransition(async () => {
      const result = next
        ? await confirmarPresenca(eventoId)
        : await cancelarPresenca(eventoId);
      if ("error" in result) {
        setError(result.error);
        setLocal(!next);
      }
    });
  }

  const isSmall = size === "small";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={local}
        style={{
          padding: isSmall ? "7px 14px" : "10px 18px",
          borderRadius: 999,
          background: local
            ? "rgba(255,255,255,0.05)"
            : "var(--shine-gold)",
          color: local ? "var(--text-1)" : "#1a0f05",
          border: local ? "1px solid var(--gold-600)" : "none",
          fontWeight: 700,
          fontSize: isSmall ? 11 : 12,
          letterSpacing: 0.5,
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {local ? textConfirmado : textConfirmar}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: "var(--rose-400)" }}>{error}</span>
      )}
    </div>
  );
}
