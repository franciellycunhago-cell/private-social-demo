"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marcarDenuncia } from "@/lib/moderacao/actions";

const MOTIVO_LABEL: Record<string, string> = {
  perfil_falso: "Perfil falso",
  conteudo_inapropriado: "Conteúdo inapropriado",
  assedio: "Assédio",
  menor_de_idade: "Menor de idade",
  outro: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  resolvida: "Resolvida",
};

export type DenunciaItem = {
  id: string;
  motivo: string;
  descricao: string | null;
  status: "aberta" | "em_analise" | "resolvida";
  createdAt: string;
  denunciante: { id: string; nome: string };
  alvo: { id: string; nome: string };
  anexoSignedUrl: string | null;
};

export function DenunciaRow({ d }: { d: DenunciaItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(status: "em_analise" | "resolvida") {
    setError(null);
    startTransition(async () => {
      const r = await marcarDenuncia(d.id, status);
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  }

  const motivoLabel = MOTIVO_LABEL[d.motivo] ?? d.motivo;
  const isAberta = d.status === "aberta";
  const isEmAnalise = d.status === "em_analise";
  const dataFmt = new Date(d.createdAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      className="card overflow-hidden"
      style={{
        borderColor: isAberta && !open ? "var(--gold-600)" : undefined,
      }}
    >
      {/* Linha compacta — sempre visível */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3"
        style={{
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-0)",
              }}
            >
              {motivoLabel}
            </span>
            {d.anexoSignedUrl && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--gold-300)",
                }}
                title="Tem anexo"
              >
                📎
              </span>
            )}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 0.5,
              color: "var(--text-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.denunciante.nome} → {d.alvo.nome} · {dataFmt}
          </div>
        </div>
        <span
          className="chip"
          style={
            d.status === "aberta"
              ? {
                  fontSize: 9,
                  color: "var(--gold-300)",
                  borderColor: "var(--gold-500)",
                  background: "rgba(212,175,110,0.12)",
                }
              : d.status === "em_analise"
                ? {
                    fontSize: 9,
                    color: "oklch(0.82 0.09 140)",
                    borderColor: "rgba(149, 176, 115, 0.4)",
                    background: "rgba(149, 176, 115, 0.08)",
                  }
                : {
                    fontSize: 9,
                    color: "var(--text-3)",
                  }
          }
        >
          {STATUS_LABEL[d.status]}
        </span>
        <span
          style={{
            color: "var(--text-3)",
            fontSize: 14,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
            display: "inline-block",
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>

      {/* Detalhes — só renderiza quando aberto */}
      {open && (
        <div
          className="flex flex-col gap-3"
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Denunciante
              </div>
              <Link
                href={`/admin/usuarios/${d.denunciante.id}`}
                style={{
                  fontSize: 13,
                  color: "var(--text-1)",
                  textDecoration: "none",
                }}
              >
                {d.denunciante.nome} ↗
              </Link>
            </div>
            <div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Alvo
              </div>
              <Link
                href={`/admin/usuarios/${d.alvo.id}`}
                style={{
                  fontSize: 13,
                  color: "var(--rose-400)",
                  textDecoration: "none",
                }}
              >
                {d.alvo.nome} ↗
              </Link>
            </div>
          </div>

          {d.anexoSignedUrl && (
            <a
              href={d.anexoSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden"
              style={{
                display: "block",
                borderRadius: 12,
                border: "1px solid var(--gold-500)",
                background: "#000",
                width: 320,
                maxWidth: "100%",
                height: 220,
                cursor: "zoom-in",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.anexoSignedUrl}
                alt="Anexo"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
              />
              <div
                className="mono absolute"
                style={{
                  top: 8,
                  left: 8,
                  background: "rgba(0,0,0,0.78)",
                  color: "var(--gold-300)",
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: 1,
                  border: "1px solid var(--gold-600)",
                  backdropFilter: "blur(4px)",
                }}
              >
                📎 clique pra ampliar
              </div>
            </a>
          )}

          {d.descricao && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-1)",
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {d.descricao}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{ fontSize: 12, color: "var(--rose-400)" }}
            >
              {error}
            </div>
          )}

          {d.status !== "resolvida" && (
            <div className="flex gap-2 flex-wrap">
              {isAberta && (
                <button
                  type="button"
                  onClick={() => handle("em_analise")}
                  disabled={pending}
                  className="btn-ghost"
                  style={{ padding: "8px 14px", fontSize: 12 }}
                >
                  Marcar em análise
                </button>
              )}
              <button
                type="button"
                onClick={() => handle("resolvida")}
                disabled={pending}
                className="btn-gold"
                style={{ padding: "8px 14px", fontSize: 12 }}
              >
                {isEmAnalise ? "Resolver" : "Resolver direto"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
