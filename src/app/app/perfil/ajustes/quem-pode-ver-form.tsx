"use client";

import { useState, useTransition } from "react";
import { atualizarQuemPodeVer, type QuemPodeVer } from "./actions";

const LABELS: { key: keyof QuemPodeVer; label: string; desc: string }[] = [
  {
    key: "casal",
    label: "Casais",
    desc: "Outros casais conseguem te ver",
  },
  {
    key: "mulher",
    label: "Mulheres",
    desc: "Mulheres solteiras conseguem te ver",
  },
  {
    key: "homem",
    label: "Homens",
    desc: "Homens solteiros conseguem te ver",
  },
];

export function QuemPodeVerForm({ initial }: { initial: QuemPodeVer }) {
  const [prefs, setPrefs] = useState<QuemPodeVer>(initial);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof QuemPodeVer) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSuccess(false);
    setError(null);
    startTransition(async () => {
      const r = await atualizarQuemPodeVer(next);
      if ("error" in r) {
        // rollback
        setPrefs(prefs);
        setError(r.error);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 1500);
    });
  }

  return (
    <div className="flex flex-col">
      {LABELS.map((item, idx) => (
        <label
          key={item.key}
          className="flex items-center gap-3 py-3"
          style={{
            borderBottom:
              idx === LABELS.length - 1 ? "none" : "1px solid var(--line)",
            cursor: "pointer",
          }}
        >
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 13, color: "var(--text-0)", fontWeight: 500 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {item.desc}
            </div>
          </div>
          <Switch
            checked={prefs[item.key]}
            onChange={() => toggle(item.key)}
            disabled={pending}
          />
        </label>
      ))}

      {(success || error) && (
        <div
          role={error ? "alert" : "status"}
          style={{
            marginTop: 8,
            fontSize: 11,
            color: error ? "var(--rose-400)" : "var(--gold-300)",
            lineHeight: 1.5,
          }}
        >
          {error ?? "✓ Salvo"}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: 10,
          background: "rgba(212,175,110,0.06)",
          border: "1px solid var(--line)",
          fontSize: 11,
          color: "var(--text-3)",
          lineHeight: 1.5,
        }}
      >
        Quem já é seu match continua tendo acesso — o filtro vale só pra
        novos descobrimentos.
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        flexShrink: 0,
        width: 42,
        height: 24,
        borderRadius: 999,
        border: "1px solid var(--line-strong)",
        background: checked ? "var(--shine-gold)" : "var(--bg-2)",
        position: "relative",
        cursor: disabled ? "wait" : "pointer",
        transition: "background 0.18s ease",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? "#1a0f05" : "var(--text-2)",
          transition: "left 0.18s ease, background 0.18s ease",
        }}
      />
    </button>
  );
}
