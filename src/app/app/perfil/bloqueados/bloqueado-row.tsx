"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { desbloquearPerfil } from "@/lib/moderacao/actions";

export type BloqueadoItem = {
  id: string;
  nome: string;
  handle: string | null;
  cidade: string;
  capa: string | null;
  bloqueadoEm: string;
};

export function BloqueadoRow({ b }: { b: BloqueadoItem }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDesbloquear() {
    if (!confirm(`Desbloquear ${b.nome}? Vocês voltam a se ver no app.`))
      return;
    setError(null);
    setRemoved(true);
    startTransition(async () => {
      const r = await desbloquearPerfil(b.id);
      if ("error" in r) {
        setError(r.error);
        setRemoved(false);
        return;
      }
      router.refresh();
    });
  }

  if (removed) return null;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl"
      style={{
        padding: 12,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
      }}
    >
      <Link
        href={`/app/p/${b.id}`}
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1px solid var(--line-strong)",
          background: "var(--bg-2)",
          textDecoration: "none",
        }}
        aria-label={`Perfil de ${b.nome}`}
      >
        {b.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={b.capa}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover", filter: "grayscale(0.6)" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--text-3)", fontSize: 18 }}
          >
            🚫
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {b.nome}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 1,
          }}
        >
          {b.handle ? `@${b.handle} · ` : ""}
          bloqueado {relativeTime(b.bloqueadoEm)}
        </div>
        {error && (
          <div
            role="alert"
            style={{ fontSize: 11, color: "var(--rose-400)", marginTop: 4 }}
          >
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleDesbloquear}
        disabled={pending}
        className="mono"
        style={{
          background: "transparent",
          border: "1px solid var(--gold-500)",
          color: "var(--gold-300)",
          padding: "7px 12px",
          borderRadius: 999,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        Desbloquear
      </button>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
