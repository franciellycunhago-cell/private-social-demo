"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usarRecoveryCode, verificarTotp } from "./actions";

export function TotpVerifyForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const r = recoveryMode
        ? await usarRecoveryCode(recoveryCode)
        : await verificarTotp(token);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push("/admin/moderacao");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!recoveryMode ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Código de 6 dígitos
            </label>
            <input
              value={token}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && token.length === 6) {
                  e.preventDefault();
                  handleVerify();
                }
              }}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
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
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Código de recuperação
          </label>
          <input
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            className="mono"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "var(--text-0)",
              fontSize: 16,
              letterSpacing: 2,
              textAlign: "center",
              outline: "none",
            }}
          />
        </div>
      )}

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
        onClick={handleVerify}
        disabled={
          pending ||
          (recoveryMode ? !recoveryCode.trim() : token.length !== 6)
        }
        className="btn-gold"
        style={{ padding: 12 }}
      >
        {pending ? "Verificando..." : "Verificar"}
      </button>

      <button
        type="button"
        onClick={() => {
          setRecoveryMode((v) => !v);
          setError(null);
        }}
        className="mono"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-3)",
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          cursor: "pointer",
          padding: "6px 0",
          textDecoration: "underline",
        }}
      >
        {recoveryMode
          ? "Voltar pro código do app"
          : "Perdi o app · usar código de recuperação"}
      </button>
    </div>
  );
}
