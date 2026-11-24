"use client";

import { useState, useTransition } from "react";
import { toggleRadarVisibilidade } from "../../radar/actions";

/* ====================================================================
 * RadarVisivelForm — toggle "aparecer no radar pros outros".
 * Default ligado (decisão 30/04 — fase de teste com poucos users).
 * ================================================================== */

export function RadarVisivelForm({ initial }: { initial: boolean }) {
  const [visivel, setVisivel] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onToggle() {
    const novo = !visivel;
    setVisivel(novo); // otimista
    setError(null);
    startTransition(async () => {
      const r = await toggleRadarVisibilidade(novo);
      if (r.error) {
        setVisivel(!novo);
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className="flex items-center justify-between p-3 rounded-xl"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          textAlign: "left",
          cursor: pending ? "progress" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>
            Aparecer no radar
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {visivel
              ? "Outros users veem você por proximidade."
              : "Você fica oculto na lista de proximidade."}
          </span>
        </div>
        <span
          aria-hidden
          style={{
            position: "relative",
            width: 38,
            height: 22,
            borderRadius: 999,
            background: visivel ? "var(--shine-gold)" : "var(--bg-1)",
            border: "1px solid var(--line-strong)",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: visivel ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: visivel ? "#1a0f05" : "var(--text-2)",
              transition: "left 0.15s",
            }}
          />
        </span>
      </button>
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 11,
            color: "var(--rose-400)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
