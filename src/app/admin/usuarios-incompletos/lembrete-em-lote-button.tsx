"use client";

import { useState } from "react";
import { AvisoModal } from "./aviso-modal";

/* ====================================================================
 * LembreteEmLoteButton — abre o modal de aviso pra TODOS de uma vez.
 * Modal cuida do envio em batch (templates + mensagem editável).
 * ================================================================== */

export function LembreteEmLoteButton({ userIds }: { userIds: string[] }) {
  const [aberto, setAberto] = useState(false);
  const total = userIds.length;

  if (total === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          background: "var(--shine-gold)",
          color: "#1a0f05",
          border: "none",
          padding: "10px 20px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: 0.3,
          alignSelf: "flex-start",
        }}
      >
        📨 Enviar aviso pra todos ({total})
      </button>
      <AvisoModal
        open={aberto}
        onClose={() => setAberto(false)}
        targetIds={userIds}
      />
    </>
  );
}
