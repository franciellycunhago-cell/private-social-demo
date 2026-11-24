"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  reopenPrivateRequest,
  respondPrivateRequest,
  revokePrivateRequest,
} from "../../conversas/actions";

/* ====================================================================
 * PedidosTabs — 3 abas (pendentes, aprovados, negados) com ações
 * inline em cada item.
 *
 *  - Pendente: Liberar / Negar
 *  - Aprovado: Revogar (vira negado)
 *  - Negado: Reverter (volta pra pendente, podendo aprovar de novo)
 * ================================================================== */

export type PedidoItem = {
  id: string;
  solicitanteId: string;
  nome: string;
  cidade: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  capa: string | null;
  createdAt: string;
  status: "pendente" | "aprovado" | "negado";
};

type Tab = "pendentes" | "aprovados" | "negados";

export function PedidosTabs({
  pendentes,
  aprovados,
  negados,
}: {
  pendentes: PedidoItem[];
  aprovados: PedidoItem[];
  negados: PedidoItem[];
}) {
  const [tab, setTab] = useState<Tab>(
    pendentes.length > 0 ? "pendentes" : "aprovados",
  );

  const lista =
    tab === "pendentes"
      ? pendentes
      : tab === "aprovados"
        ? aprovados
        : negados;

  return (
    <>
      <div
        className="flex gap-1.5 mb-5 overflow-x-auto scroll"
        style={{ scrollbarWidth: "none" }}
      >
        <TabBtn
          active={tab === "pendentes"}
          onClick={() => setTab("pendentes")}
          badge={pendentes.length}
        >
          Para aprovar
        </TabBtn>
        <TabBtn
          active={tab === "aprovados"}
          onClick={() => setTab("aprovados")}
        >
          Aprovados · {aprovados.length}
        </TabBtn>
        <TabBtn
          active={tab === "negados"}
          onClick={() => setTab("negados")}
        >
          Recusados · {negados.length}
        </TabBtn>
      </div>

      {lista.length === 0 ? (
        <div
          className="card flex flex-col items-center text-center gap-2"
          style={{ padding: 32 }}
        >
          <div style={{ fontSize: 32 }}>
            {tab === "pendentes" ? "✉️" : tab === "aprovados" ? "🔓" : "🚫"}
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 500, color: "var(--text-1)" }}
          >
            {tab === "pendentes"
              ? "Nenhum pedido aguardando"
              : tab === "aprovados"
                ? "Ninguém com acesso ainda"
                : "Nenhum pedido recusado"}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            {tab === "pendentes"
              ? "Os pedidos novos aparecem aqui pra você liberar ou negar."
              : tab === "aprovados"
                ? "Quando você liberar acesso, a pessoa entra nesta lista."
                : "Você não recusou ninguém ainda."}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((p) => (
            <PedidoRow key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono flex-shrink-0 flex items-center gap-1.5"
      style={{
        background: active
          ? "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))"
          : "transparent",
        border: active ? "1px solid var(--gold-500)" : "1px solid var(--line)",
        color: active ? "var(--gold-300)" : "var(--text-2)",
        padding: "7px 14px",
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <span>{children}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PedidoRow({ p }: { p: PedidoItem }) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  function aprovar() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const r = await respondPrivateRequest(p.id, true);
      if ("error" in r) {
        setError(r.error);
        setHidden(false);
      }
    });
  }
  function negar() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const r = await respondPrivateRequest(p.id, false);
      if ("error" in r) {
        setError(r.error);
        setHidden(false);
      }
    });
  }
  function revogar() {
    if (!confirm(`Revogar acesso de ${p.nome}? Vai pra recusados.`)) return;
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const r = await revokePrivateRequest(p.id);
      if ("error" in r) {
        setError(r.error);
        setHidden(false);
      }
    });
  }
  function reabrir() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      const r = await reopenPrivateRequest(p.id);
      if ("error" in r) {
        setError(r.error);
        setHidden(false);
      }
    });
  }

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
        href={`/app/p/${p.solicitanteId}`}
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
          textDecoration: "none",
        }}
        aria-label={`Perfil de ${p.nome}`}
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
            ♥
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/app/p/${p.solicitanteId}`}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-0)",
            textDecoration: "none",
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {p.nome}
        </Link>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 1,
          }}
        >
          {[p.cidade, tipoLabel(p.tipo), relativeTime(p.createdAt)]
            .filter(Boolean)
            .join(" · ")}
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

      {p.status === "pendente" && (
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={negar}
            disabled={pending}
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            Negar
          </button>
          <button
            type="button"
            onClick={aprovar}
            disabled={pending}
            className="mono"
            style={{
              background: "var(--shine-gold)",
              color: "#1a0f05",
              border: "none",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 800,
            }}
          >
            Liberar
          </button>
        </div>
      )}
      {p.status === "aprovado" && (
        <button
          type="button"
          onClick={revogar}
          disabled={pending}
          className="mono flex-shrink-0"
          style={{
            background: "transparent",
            border: "1px solid rgba(217,138,114,0.4)",
            color: "var(--rose-400)",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: pending ? "wait" : "pointer",
            fontWeight: 700,
          }}
        >
          Revogar
        </button>
      )}
      {p.status === "negado" && (
        <button
          type="button"
          onClick={reabrir}
          disabled={pending}
          className="mono flex-shrink-0"
          style={{
            background: "transparent",
            border: "1px solid var(--gold-500)",
            color: "var(--gold-300)",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: pending ? "wait" : "pointer",
            fontWeight: 700,
          }}
        >
          Reabrir
        </button>
      )}
    </div>
  );
}

function tipoLabel(t: "casal" | "homem" | "mulher" | null): string | null {
  if (!t) return null;
  return t === "casal" ? "Casal" : t === "mulher" ? "Mulher" : "Homem";
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
