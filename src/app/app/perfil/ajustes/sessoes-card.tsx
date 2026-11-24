"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sairDeTodasSessoes } from "./actions";

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessoesCard({
  ultimoLogin,
  confirmadoEm,
}: {
  ultimoLogin: string | null;
  confirmadoEm: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSair() {
    if (
      !confirm(
        "Encerrar todas as sessões? Você vai precisar logar de novo (incluindo aqui).",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await sairDeTodasSessoes();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // Após signOut global, server vai derrubar — refresh joga pro /login
      router.refresh();
      router.push("/login");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid grid-cols-2 gap-2"
        style={{ fontSize: 11, color: "var(--text-2)" }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 2,
            }}
          >
            Último login
          </div>
          {formatarData(ultimoLogin)}
        </div>
        <div>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 2,
            }}
          >
            Email confirmado
          </div>
          {formatarData(confirmadoEm)}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md p-2.5"
          style={{
            background: "rgba(220,80,80,0.1)",
            border: "1px solid rgba(220,80,80,0.3)",
            color: "oklch(0.85 0.1 25)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSair}
        disabled={pending}
        className="mono"
        style={{
          background: "rgba(217,138,114,0.08)",
          border: "1px solid rgba(217,138,114,0.5)",
          color: "var(--rose-400)",
          padding: "10px 14px",
          borderRadius: 999,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          cursor: pending ? "wait" : "pointer",
          fontWeight: 700,
        }}
      >
        {pending ? "Encerrando..." : "🚪 Encerrar todas as sessões"}
      </button>
    </div>
  );
}
