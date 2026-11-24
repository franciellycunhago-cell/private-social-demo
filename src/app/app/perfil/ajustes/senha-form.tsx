"use client";

import { useState, useTransition } from "react";
import { atualizarSenha } from "./actions";
import { PasswordInput } from "@/components/password-input";

export function SenhaForm() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (nova.length < 8) {
      setError("A senha nova precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (nova !== confirma) {
      setError("As duas senhas novas não batem.");
      return;
    }

    startTransition(async () => {
      const r = await atualizarSenha(atual, nova);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess(r.mensagem ?? "Senha atualizada.");
      setAtual("");
      setNova("");
      setConfirma("");
      window.setTimeout(() => setSuccess(null), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field
        label="Senha atual"
        type="password"
        value={atual}
        onChange={setAtual}
        autoComplete="current-password"
        required
      />
      <Field
        label="Senha nova"
        type="password"
        value={nova}
        onChange={setNova}
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Field
        label="Confirma a senha nova"
        type="password"
        value={confirma}
        onChange={setConfirma}
        autoComplete="new-password"
        required
        minLength={8}
      />

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
          }}
        >
          ✓ {success}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold mt-1"
        style={{ padding: "10px 20px", fontSize: 12 }}
      >
        {pending ? "Salvando..." : "Atualizar senha"}
      </button>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const isPassword = type === "password";
  return (
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
        {label}
      </span>
      {isPassword ? (
        <PasswordInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder="••••••••"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="input-field"
          placeholder="••••••••"
        />
      )}
    </label>
  );
}
