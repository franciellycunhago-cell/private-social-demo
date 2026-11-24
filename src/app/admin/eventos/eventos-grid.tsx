"use client";

import { useState } from "react";
import { eventoDiaMes, eventoHora } from "@/lib/eventos";
import { EventoForm, type EventoFormValues } from "./evento-form";

/* ====================================================================
 * EventosGrid — client
 *
 * Recebe a lista serializada do server e renderiza os cards. Abre o
 * modal EventoForm em "Novo evento" ou clique no card.
 * ================================================================== */

export type EventoCardData = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  local: string | null;
  cidade: string | null;
  capacidade: number | null;
  dress_code: string | null;
  tipo: "proprio" | "patrocinado";
  patrocinador_nome: string | null;
  valor_patrocinio: number | null;
  foto_url: string | null;
  foto_preview: string | null;
  vip_only: boolean;
  publicado: boolean;
  destacado: boolean;
  confirmacoes: number;
};

function blankForm(): EventoFormValues {
  const data = new Date();
  data.setDate(data.getDate() + 7);
  data.setHours(22, 0, 0, 0);
  return {
    titulo: "",
    descricao: null,
    data: data.toISOString(),
    local: null,
    cidade: null,
    capacidade: null,
    dress_code: null,
    tipo: "proprio",
    patrocinador_nome: null,
    valor_patrocinio: null,
    foto_url: null,
    vip_only: false,
    publicado: false,
    destacado: false,
  };
}

function toForm(e: EventoCardData): EventoFormValues {
  return {
    id: e.id,
    titulo: e.titulo,
    descricao: e.descricao,
    data: e.data,
    local: e.local,
    cidade: e.cidade,
    capacidade: e.capacidade,
    dress_code: e.dress_code,
    tipo: e.tipo,
    patrocinador_nome: e.patrocinador_nome,
    valor_patrocinio: e.valor_patrocinio,
    foto_url: e.foto_url,
    vip_only: e.vip_only,
    publicado: e.publicado,
    destacado: e.destacado,
  };
}

function formatDate(iso: string): string {
  // Usa helpers do lib/eventos que formatam em America/Sao_Paulo, pra
  // não ter shift de timezone no server (Vercel roda em UTC).
  const { dia, mes } = eventoDiaMes(iso);
  const hora = eventoHora(iso);
  return `${dia} ${mes} · ${hora}h`;
}

export function EventosGrid({
  eventos,
  totalAtivos,
  totalRascunhos,
}: {
  eventos: EventoCardData[];
  totalAtivos: number;
  totalRascunhos: number;
}) {
  const [editing, setEditing] = useState<EventoFormValues | null>(null);

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1
            className="display"
            style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Eventos
          </h1>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginTop: 4,
            }}
          >
            {totalAtivos} publicado{totalAtivos === 1 ? "" : "s"} ·{" "}
            {totalRascunhos} rascunho{totalRascunhos === 1 ? "" : "s"} ·{" "}
            {eventos.length} total
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(blankForm())}
          className="btn-gold"
          style={{ padding: "9px 16px", fontSize: 13 }}
        >
          ＋ Novo evento
        </button>
      </div>

      {eventos.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: "var(--bg-1)",
            border: "1px dashed var(--line-strong)",
          }}
        >
          <div
            className="display"
            style={{ fontSize: 20, color: "var(--text-1)", marginBottom: 6 }}
          >
            Nenhum evento cadastrado
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-3)",
              maxWidth: 380,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            Clica em "Novo evento" pra montar o primeiro. Ele fica como
            rascunho até você publicar — aí aparece no feed do app.
          </div>
        </div>
      )}

      {eventos.length > 0 && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {eventos.map((e) => (
            <EventoCard key={e.id} evento={e} onEdit={() => setEditing(toForm(e))} />
          ))}
        </div>
      )}

      {editing && (
        <EventoForm initial={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function EventoCard({
  evento,
  onEdit,
}: {
  evento: EventoCardData;
  onEdit: () => void;
}) {
  const isPast = new Date(evento.data).getTime() < Date.now();
  const statusLabel = !evento.publicado
    ? "Rascunho"
    : isPast
      ? "Encerrado"
      : evento.vip_only
        ? "VIP"
        : "Ativo";
  const statusColor = !evento.publicado
    ? "var(--text-3)"
    : isPast
      ? "var(--text-3)"
      : evento.vip_only
        ? "var(--gold-300)"
        : "oklch(0.78 0.14 155)";

  return (
    <button
      type="button"
      onClick={onEdit}
      className="text-left rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        padding: 0,
        opacity: isPast ? 0.65 : 1,
      }}
    >
      <div className="relative" style={{ aspectRatio: "16/9" }}>
        {evento.foto_preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={evento.foto_preview}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, rgba(212,175,110,0.32), transparent 55%), linear-gradient(135deg, #2a1810, #0a0706 70%)",
            }}
          />
        )}
        <div
          className="absolute flex items-center gap-1.5"
          style={{ top: 10, left: 10 }}
        >
          <div
            className="flex items-center gap-1"
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              color: statusColor,
              border: `1px solid ${statusColor}`,
              backdropFilter: "blur(6px)",
            }}
          >
            ● {statusLabel}
          </div>
          {evento.destacado && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1,
                padding: "3px 9px",
                borderRadius: 999,
                background: "var(--shine-gold)",
                color: "#1a0f05",
              }}
            >
              ★ DESTACADO
            </div>
          )}
        </div>
        <div
          className="absolute"
          style={{
            top: 10,
            right: 10,
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            color: "var(--gold-300)",
            letterSpacing: 1,
          }}
        >
          {formatDate(evento.data)}
        </div>
        <div
          className="absolute"
          style={{
            left: 12,
            right: 12,
            bottom: 10,
            color: "#fff",
          }}
        >
          <div
            className="display truncate"
            style={{
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {evento.titulo || "Sem título"}
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2">
        {evento.local && (
          <Line label="Local" value={evento.local} />
        )}
        {evento.dress_code && <Line label="Dress code" value={evento.dress_code} />}
        {evento.tipo === "patrocinado" && evento.patrocinador_nome && (
          <Line
            label="Patrocinador"
            value={
              evento.valor_patrocinio
                ? `${evento.patrocinador_nome} · R$ ${evento.valor_patrocinio.toFixed(0)}`
                : evento.patrocinador_nome
            }
          />
        )}
        <div
          className="flex items-center justify-between mt-auto pt-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--gold-300)",
            }}
          >
            {evento.confirmacoes}
            {evento.capacidade ? `/${evento.capacidade}` : ""} confirmad
            {evento.confirmacoes === 1 ? "o" : "os"}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Editar →
          </span>
        </div>
      </div>
    </button>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--text-1)" }}>{value}</span>
    </div>
  );
}
