"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelarConvite, gerarConvite } from "@/lib/convites/actions";

export type ConviteItem = {
  id: string;
  codigo: string;
  status: "ativo" | "aceito" | "verificado" | "expirado";
  criadoEm: string;
  expiraEm: string;
  usadoEm: string | null;
  convidado: { id: string; nome: string; verificado: boolean } | null;
};

const STATUS_LABEL: Record<ConviteItem["status"], string> = {
  ativo: "Ativo",
  aceito: "Cadastrado",
  verificado: "Verificado",
  expirado: "Expirado",
};

const STATUS_COR: Record<ConviteItem["status"], React.CSSProperties> = {
  ativo: {
    color: "var(--gold-300)",
    borderColor: "var(--gold-500)",
    background: "rgba(212,175,110,0.12)",
  },
  aceito: {
    color: "oklch(0.82 0.09 140)",
    borderColor: "rgba(149, 176, 115, 0.4)",
    background: "rgba(149, 176, 115, 0.08)",
  },
  verificado: {
    color: "#1a0f05",
    borderColor: "var(--gold-600)",
    background: "var(--shine-gold)",
    fontWeight: 800,
  },
  expirado: {
    color: "var(--text-3)",
    borderColor: "var(--line-strong)",
    background: "rgba(255,255,255,0.04)",
  },
};

export function ConvitesPanel({
  ativos,
  historico,
  slotsLivres,
  limiteTotal,
}: {
  ativos: ConviteItem[];
  historico: ConviteItem[];
  slotsLivres: number;
  limiteTotal: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGerar() {
    if (pending) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await gerarConvite();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess(`Código ${r.codigo} criado.`);
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleCancelar(id: string) {
    if (!confirm("Cancelar esse convite? O código não vai mais funcionar."))
      return;
    setError(null);
    startTransition(async () => {
      const r = await cancelarConvite(id);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl p-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
          border: "1px solid var(--gold-600)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--gold-300)",
            fontWeight: 700,
          }}
        >
          Slots disponíveis
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <div
            className="display"
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "var(--gold-300)",
            }}
          >
            {slotsLivres}{" "}
            <span style={{ fontSize: 14, color: "var(--text-3)" }}>
              / {limiteTotal}
            </span>
          </div>
          <button
            type="button"
            onClick={handleGerar}
            disabled={pending || slotsLivres === 0}
            className="btn-gold"
            style={{
              padding: "10px 18px",
              fontSize: 12,
              opacity: pending || slotsLivres === 0 ? 0.5 : 1,
            }}
          >
            {pending ? "Gerando..." : "Gerar novo"}
          </button>
        </div>
        {slotsLivres === 0 && (
          <div
            style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}
          >
            Cancela um convite ou espera ele ser usado/expirar pra liberar slot.
          </div>
        )}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-xl p-2.5"
          style={{
            background: "rgba(149, 176, 115, 0.1)",
            border: "1px solid rgba(149, 176, 115, 0.4)",
            color: "oklch(0.82 0.09 140)",
            fontSize: 12,
          }}
        >
          ✓ {success}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl p-2.5"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {ativos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              fontWeight: 700,
            }}
          >
            Ativos · compartilhe esses códigos
          </h2>
          {ativos.map((c) => (
            <ConviteAtivo key={c.id} c={c} onCancelar={handleCancelar} />
          ))}
        </section>
      )}

      {historico.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              fontWeight: 700,
            }}
          >
            Histórico
          </h2>
          {historico.map((c) => (
            <ConviteHistorico key={c.id} c={c} />
          ))}
        </section>
      )}

      {ativos.length === 0 && historico.length === 0 && (
        <div
          className="card flex flex-col items-center text-center gap-2"
          style={{ padding: 32 }}
        >
          <div style={{ fontSize: 32 }}>🎟</div>
          <div
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}
          >
            Nenhum convite ainda
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            Cada código PSC-XXXX-XXXX vale 1 cadastro. Compartilha com
            quem você indica.
          </div>
        </div>
      )}
    </div>
  );
}

function ConviteAtivo({
  c,
  onCancelar,
}: {
  c: ConviteItem;
  onCancelar: (id: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);

  // Monta URL pronta de cadastro com o convite no query param.
  // Usa window.location.origin pra funcionar em qualquer ambiente
  // (preview, prod, localhost) sem depender de env var.
  function buildInviteUrl(): string {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://example.com";
    return `${origin}/cadastro?convite=${c.codigo}`;
  }

  function buildShareMessage(): string {
    const url = buildInviteUrl();
    return `Você foi convidado pro PrivateSocial 🌹\n\nComunidade reservada, verificada, discreta.\n\n→ ${url}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(buildInviteUrl()).then(() => {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    });
  }

  async function share() {
    const url = buildInviteUrl();
    const text = buildShareMessage();

    // Web Share API: abre o picker nativo (WhatsApp, Telegram, Insta DM,
    // SMS, Mail...). Disponível em iOS/Android PWAs e Chrome/Edge desktop.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Convite — PrivateSocial",
          text,
          url,
        });
        return;
      } catch {
        // User cancelou ou browser rejeitou — cai no fallback
      }
    }
    // Fallback: copia a mensagem inteira pro clipboard
    await navigator.clipboard.writeText(text);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  const diasRestantes = Math.max(
    0,
    Math.ceil(
      (new Date(c.expiraEm).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    ),
  );

  return (
    <div
      className="rounded-xl flex flex-col gap-2.5"
      style={{
        padding: 12,
        background: "var(--bg-1)",
        border: "1px solid var(--gold-500)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="mono"
            style={{
              fontSize: 14,
              letterSpacing: 1.5,
              color: "var(--gold-300)",
              fontWeight: 700,
            }}
          >
            {c.codigo}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
            Expira em {diasRestantes} dia{diasRestantes === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCancelar(c.id)}
          aria-label="Cancelar convite"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-3)",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 6px",
          }}
        >
          ×
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={share}
          className="mono flex-1"
          style={{
            background: "var(--shine-gold)",
            border: "none",
            color: "#1a0f05",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ShareIcon /> Compartilhar
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="mono"
          style={{
            background: copiado ? "rgba(149,176,115,0.15)" : "transparent",
            border: copiado
              ? "1px solid rgba(149,176,115,0.5)"
              : "1px solid var(--gold-600)",
            color: copiado ? "oklch(0.82 0.09 140)" : "var(--gold-300)",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          title="Copia o link com o convite — só colar no WhatsApp"
        >
          {copiado ? "Copiado ✓" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function ConviteHistorico({ c }: { c: ConviteItem }) {
  return (
    <div
      className="rounded-xl flex items-center gap-3"
      style={{
        padding: 12,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        opacity: c.status === "expirado" ? 0.6 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="mono"
          style={{
            fontSize: 12,
            letterSpacing: 1,
            color:
              c.status === "expirado"
                ? "var(--text-3)"
                : "var(--text-1)",
            textDecoration:
              c.status === "expirado" ? "line-through" : undefined,
          }}
        >
          {c.codigo}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
          {c.convidado ? (
            <Link
              href={`/app/p/${c.convidado.id}`}
              style={{
                color: "var(--text-2)",
                textDecoration: "none",
                borderBottom: "1px dashed var(--line-strong)",
              }}
            >
              {c.convidado.nome} ↗
            </Link>
          ) : c.status === "expirado" ? (
            "Não foi usado a tempo"
          ) : (
            "—"
          )}
        </div>
      </div>
      <span
        className="chip"
        style={{
          fontSize: 9,
          padding: "3px 9px",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: 700,
          ...STATUS_COR[c.status],
        }}
      >
        {STATUS_LABEL[c.status]}
      </span>
    </div>
  );
}
