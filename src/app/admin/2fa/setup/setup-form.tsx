"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarSetup } from "./actions";

export function SetupForm({
  secret,
  recoveryHashes,
}: {
  secret: string;
  recoveryHashes: string[];
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirmar() {
    if (pending) return;
    if (token.length !== 6) {
      setError("Código deve ter 6 dígitos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await confirmarSetup(secret, recoveryHashes, token);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push("/admin/moderacao");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-2)",
        }}
      >
        Código atual do app
      </label>
      <input
        value={token}
        onChange={(e) =>
          setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && token.length === 6) {
            e.preventDefault();
            handleConfirmar();
          }
        }}
        placeholder="000000"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="mono"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "14px 16px",
          color: "var(--text-0)",
          fontSize: 24,
          letterSpacing: 8,
          textAlign: "center",
          outline: "none",
        }}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl p-2.5"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirmar}
        disabled={pending || token.length !== 6}
        className="btn-gold mt-1"
        style={{ padding: 12 }}
      >
        {pending ? "Ativando..." : "Ativar 2FA"}
      </button>
    </div>
  );
}
