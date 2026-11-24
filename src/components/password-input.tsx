"use client";

import { useState } from "react";

/* ====================================================================
 * PasswordInput — input de senha com toggle olho mostrar/esconder.
 *
 * Usa <input type="password"> ou "text" controlado por state local.
 * Mantém todas as props padrão (name, required, autoComplete, etc).
 *
 * Estilo casa com .input-field do globals (mesma altura/borda/padding),
 * com botão olho absoluto à direita dentro do input.
 * ================================================================== */

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Classe extra opcional. Default já aplica .input-field. */
  className?: string;
};

export function PasswordInput({ className, style, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={className ?? "input-field"}
        style={{
          ...(style ?? {}),
          paddingRight: 44,
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "transparent",
          border: "none",
          color: "var(--text-3)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
