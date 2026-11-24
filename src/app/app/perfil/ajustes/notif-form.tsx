"use client";

import { useState, useTransition } from "react";
import { atualizarNotifPrefs, type NotifPrefs } from "./actions";

const LABELS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  {
    key: "matches",
    label: "Match novo",
    desc: "Quando alguém te curte de volta",
  },
  {
    key: "mensagens",
    label: "Mensagens",
    desc: "Mensagens novas em conversas",
  },
  {
    key: "curtida_recebida",
    label: "Curtida recebida",
    desc: "Alguém curtiu seu perfil",
  },
  {
    key: "curtidas_post",
    label: "Curtidas em posts",
    desc: "Alguém curtiu um post seu",
  },
  {
    key: "comentarios_post",
    label: "Comentários",
    desc: "Alguém comentou seu post",
  },
  {
    key: "eventos_novos",
    label: "Eventos novos",
    desc: "Quando o Admin lança um evento na sua cidade",
  },
];

export function NotifForm({ initialPrefs }: { initialPrefs: NotifPrefs }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(initialPrefs);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSuccess(false);
    setError(null);
    startTransition(async () => {
      const r = await atualizarNotifPrefs(next);
      if ("error" in r) {
        // rollback otimista
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
          }}
        >
          {error ?? "✓ Salvo"}
        </div>
      )}
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
