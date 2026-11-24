"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { respondPrivateRequest } from "./actions";

/* ====================================================================
 * PedidosPendentes — client
 *
 * Lista de pedidos de acesso a fotos privadas onde EU sou o alvo.
 * Cada item tem botões "Liberar" (aprovar) e "Negar" (negar).
 * Optimistic update: remove da lista ao responder.
 * ================================================================== */

export type PedidoPendente = {
  id: string;
  solicitanteId: string;
  nome: string;
  capa: string | null;
  cidade: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  createdAt: string;
};

export function PedidosPendentes({ iniciais }: { iniciais: PedidoPendente[] }) {
  const [pedidos, setPedidos] = useState(iniciais);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (pedidos.length === 0) return null;

  function responder(pedidoId: string, aprovar: boolean) {
    setError(null);
    const snapshot = pedidos;
    setPedidos((atual) => atual.filter((p) => p.id !== pedidoId));

    startTransition(async () => {
      const result = await respondPrivateRequest(pedidoId, aprovar);
      if ("error" in result) {
        setError(result.error);
        setPedidos(snapshot);
      }
    });
  }

  return (
    <section className="pt-6">
      <div
        className="mono flex items-center justify-between"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--gold-300)",
          marginBottom: 8,
        }}
      >
        <span>Pedidos de acesso privado</span>
        <span style={{ color: "var(--text-3)", letterSpacing: 1 }}>
          {pedidos.length}
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, rgba(212,175,110,0.10), rgba(212,175,110,0.02))",
          border: "1px solid var(--line-strong)",
        }}
      >
        {pedidos.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom:
                i === pedidos.length - 1 ? "none" : "1px solid var(--line)",
            }}
          >
            <Link
              href={`/app/p/${p.solicitanteId}`}
              className="relative overflow-hidden flex-shrink-0"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1px solid var(--gold-600)",
                background: "var(--bg-2)",
                textDecoration: "none",
              }}
              aria-label={`Ver perfil de ${p.nome}`}
            >
              {p.capa ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.capa}
                  alt=""
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: "var(--gold-300)", fontSize: 18 }}
                >
                  🔒
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div
                className="truncate"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-0)",
                }}
              >
                {p.nome}
              </div>
              <div
                className="truncate"
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginTop: 1,
                }}
              >
                Pediu acesso · {relativeTime(p.createdAt)}
                {p.cidade && ` · ${p.cidade}`}
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => responder(p.id, false)}
                disabled={pending}
                aria-label="Negar"
                className="flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--line)",
                  color: "var(--text-2)",
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
              <button
                type="button"
                onClick={() => responder(p.id, true)}
                disabled={pending}
                aria-label="Liberar fotos privadas"
                className="flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--shine-gold)",
                  border: "none",
                  color: "#1a0f05",
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: pending ? 0.7 : 1,
                }}
              >
                ✓
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-2 rounded-xl p-3"
          style={{
            background: "rgba(217, 138, 114, 0.08)",
            border: "1px solid rgba(217, 138, 114, 0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  return `há ${days}d`;
}
