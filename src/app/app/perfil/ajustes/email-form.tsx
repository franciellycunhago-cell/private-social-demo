"use client";

import { useState, useTransition } from "react";
import { atualizarEmail } from "./actions";

export function EmailForm({ emailAtual }: { emailAtual: string }) {
  const [novo, setNovo] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const limpo = novo.trim().toLowerCase();
    if (!limpo) {
      setError("Digite o novo email.");
      return;
    }
    if (limpo === emailAtual.toLowerCase()) {
      setError("Esse já é o seu email atual.");
      return;
    }

    startTransition(async () => {
      const r = await atualizarEmail(limpo);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess(r.mensagem ?? "Confirma no novo email.");
      setNovo("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div
        className="rounded-md p-2.5"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Email atual
        </div>
        <div style={{ fontSize: 13, color: "var(--text-1)", marginTop: 2 }}>
          {emailAtual || "—"}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          Novo email
        </span>
        <input
          type="email"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          autoComplete="email"
          required
          className="input-field"
          placeholder="voce@email.com"
        />
      </label>

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
      {success && (
        <div
          role="status"
          className="rounded-md p-2.5"
          style={{
            background: "rgba(149, 176, 115, 0.1)",
            border: "1px solid rgba(149, 176, 115, 0.4)",
            color: "oklch(0.82 0.09 140)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          ✓ {success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold"
        style={{ padding: "10px 20px", fontSize: 12 }}
      >
        {pending ? "Enviando..." : "Trocar email"}
      </button>
    </form>
  );
}
