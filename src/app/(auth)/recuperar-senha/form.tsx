"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";
import { SubmitButton } from "../submit-button";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function RecuperarForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
          Email da conta
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
            background: "rgba(212, 175, 110, 0.08)",
            border: "1px solid var(--line-strong)",
            color: "var(--gold-100)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
          role="status"
        >
          {state.success}
        </div>
      ) : (
        <>
          <TurnstileWidget />
          <SubmitButton>Enviar link</SubmitButton>
        </>
      )}
    </form>
  );
}
