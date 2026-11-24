"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/* ====================================================================
 * SearchForm — input controlado que navega pra ?q= com debounce simples.
 *  - Onsubmit (Enter ou botão) navega imediatamente
 *  - Onchange dispara navigate depois de 350ms
 * ================================================================== */

export function SearchForm({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navegar(q: string) {
    const limpo = q.trim();
    startTransition(() => {
      if (limpo.length === 0) {
        router.push("/app/buscar");
      } else {
        router.push(`/app/buscar?q=${encodeURIComponent(limpo)}`);
      }
    });
  }

  let debounceId: ReturnType<typeof setTimeout> | null = null;
  function onChange(v: string) {
    setValor(v);
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => navegar(v), 350);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navegar(valor);
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        className="flex items-center gap-2 rounded-full"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          padding: "10px 14px",
          opacity: isPending ? 0.7 : 1,
        }}
      >
        <span style={{ fontSize: 16 }} aria-hidden>
          🔍
        </span>
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome, @handle, cidade…"
          autoFocus
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-0)",
            fontSize: 14,
            fontFamily: "var(--font-ui)",
          }}
        />
        {valor && (
          <button
            type="button"
            onClick={() => {
              setValor("");
              navegar("");
            }}
            aria-label="Limpar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-3)",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ×
          </button>
        )}
      </div>
    </form>
  );
}
