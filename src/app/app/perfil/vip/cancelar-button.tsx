"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarMinhaAssinatura } from "../../vip/actions";

export function CancelarVipButton({
  statusAtual,
}: {
  statusAtual: "trial" | "ativa" | "inadimplente";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancelar() {
    const msg =
      statusAtual === "trial"
        ? "Cancelar a assinatura?\n\nVocê não vai ser cobrado e perde o acesso VIP imediatamente."
        : "Cancelar a assinatura?\n\nVocê mantém o acesso VIP até o fim do período já pago. Depois disso volta pro plano grátis.";
    if (!confirm(msg)) return;

    setError(null);
    startTransition(async () => {
      const r = await cancelarMinhaAssinatura();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCancelar}
        disabled={pending}
        className="mono w-full"
        style={{
          background: "transparent",
          border: "1px solid rgba(217,138,114,0.4)",
          color: "var(--rose-400)",
          padding: "11px 18px",
          borderRadius: 999,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Cancelando..." : "Cancelar assinatura"}
      </button>
      {error && (
        <div
          role="alert"
          className="rounded-xl p-2.5"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
