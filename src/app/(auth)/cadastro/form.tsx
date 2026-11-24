"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";
import { SubmitButton } from "../submit-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { PasswordInput } from "@/components/password-input";

type Props = {
  convite?: string;
};

export function CadastroForm({ convite }: Props = {}) {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, null);
  const [termosOk, setTermosOk] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {convite && <input type="hidden" name="convite" value={convite} />}
      <label className="flex flex-col gap-1.5">
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          className="input-field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          Senha (mínimo 8 caracteres)
        </span>
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </label>

      {/* Aceite dos Termos + Privacidade */}
      <label
        className="flex items-start gap-2.5 cursor-pointer"
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: termosOk
            ? "1px solid var(--gold-500)"
            : "1px solid var(--line)",
          background: termosOk ? "rgba(212,175,110,0.06)" : "var(--bg-1)",
          transition: "all 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          name="termos_aceitos"
          required
          checked={termosOk}
          onChange={(e) => setTermosOk(e.target.checked)}
          style={{
            marginTop: 2,
            accentColor: "var(--gold-500)",
            width: 18,
            height: 18,
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.5 }}>
          Tenho 18 anos ou mais e li e aceito os{" "}
          <Link
            href="/termos"
            target="_blank"
            style={{
              color: "var(--gold-300)",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacidade"
            target="_blank"
            style={{
              color: "var(--gold-300)",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      {state?.error ? (
        <div
          className="px-3 py-2.5 rounded-md"
          style={{
            background: "rgba(220, 80, 80, 0.12)",
            border: "1px solid rgba(220, 80, 80, 0.3)",
            color: "oklch(0.85 0.1 25)",
            fontSize: 13,
          }}
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state?.success ? (
        <div
          className="px-3 py-2.5 rounded-md"
          style={{
            background: "rgba(212, 175, 110, 0.12)",
            border: "1px solid var(--line-strong)",
            color: "var(--gold-100)",
            fontSize: 13,
          }}
          role="status"
        >
          {state.success}
        </div>
      ) : null}

      <TurnstileWidget />

      <SubmitButton>Criar acesso</SubmitButton>

      <p
        className="text-center"
        style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}
      >
        Aprovação manual pelo Admin após cadastro.
      </p>
    </form>
  );
}
