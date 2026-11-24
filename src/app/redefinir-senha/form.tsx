"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "../(auth)/actions";
import { SubmitButton } from "../(auth)/submit-button";
import { PasswordInput } from "@/components/password-input";

export function RedefinirForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
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
          Nova senha (mínimo 8 caracteres)
        </span>
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
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
          Confirme a senha
        </span>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
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

      <SubmitButton>Salvar nova senha</SubmitButton>
    </form>
  );
}
