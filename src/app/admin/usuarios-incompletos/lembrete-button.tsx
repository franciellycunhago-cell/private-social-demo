"use client";

import { useState } from "react";
import { AvisoModal } from "./aviso-modal";

/* ====================================================================
 * LembreteButton — botão admin que abre o modal de aviso pra UM user.
 * O modal cuida do envio (templates + mensagem editável).
 * ================================================================== */

export function LembreteButton({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          background: "var(--shine-gold)",
          color: "#1a0f05",
          border: "none",
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: 0.3,
          whiteSpace: "nowrap",
          minWidth: 116,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        📨 Aviso
      </button>
      <AvisoModal
        open={aberto}
        onClose={() => setAberto(false)}
        targetIds={[userId]}
      />
    </>
  );
}
