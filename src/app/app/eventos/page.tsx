import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import {
  EVENTO_COLS,
  eventoDiaMes,
  eventoHora,
  formatEventoData,
  type EventoRow,
} from "@/lib/eventos";
import { resolveEventoFotos } from "@/lib/eventos-server";
import { PageHeading } from "@/components/page-heading";
import { PresencaButton } from "./presenca-button";

export const metadata = {
  title: "Eventos — PrivateSocial",
};

/* ====================================================================
 * /app/eventos
 *
 *  - Header com título e sub
 *  - Evento em destaque: o próximo evento (data >= hoje), com foto e CTA
 *  - Lista "Próximos" com os demais
 *  - Filtros: Próximos / Esta semana / VIP
 *  - Empty state quando não tem evento
 * ================================================================== */

type SearchParams = Promise<{ filtro?: string }>;

type Confirmacao = {
  evento_id: string;
};

export default async function EventosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const { filtro } = await searchParams;

  const supabase = await createClient();

  const agora = new Date();
  const umaSemanaDepois = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  let q = supabase
    .from("eventos")
    .select(EVENTO_COLS)
    .eq("publicado", true)
    .gte("data", agora.toISOString())
    .order("data", { ascending: true })
    .limit(50);

  if (filtro === "semana") {
    q = q.lte("data", umaSemanaDepois.toISOString());
  } else if (filtro === "vip") {
    q = q.eq("vip_only", true);
  }

  const [{ data: eventosRaw }, { data: confirmacoesRaw }] = await Promise.all([
    q,
    supabase
      .from("confirmacoes_evento")
      .select("evento_id")
      .eq("profile_id", meId),
  ]);

  const eventos = (eventosRaw ?? []) as EventoRow[];
  const confirmados = new Set(
    ((confirmacoesRaw ?? []) as Confirmacao[]).map((c) => c.evento_id),
  );

  const fotoMap = await resolveEventoFotos(eventos);

  // Destaque: se admin marcou `destacado=true` num evento futuro, usa
  // ele. Senão, o primeiro da lista (mais próximo no tempo).
  const idxDestacado = eventos.findIndex((e) => e.destacado);
  const destaque =
    idxDestacado >= 0 ? eventos[idxDestacado] : (eventos[0] ?? null);
  const outros = eventos.filter((e) => e.id !== destaque?.id);

  return (
    <div className="flex flex-col px-5 pt-10 pb-6">
      <PageHeading title="Eventos" subtitle="Encontros discretos, curados pela comunidade" />

      <div className="flex gap-2 overflow-x-auto scroll pt-4 pb-1">
        <FilterChip label="Próximos" active={!filtro} href="/app/eventos" />
        <FilterChip
          label="Esta semana"
          active={filtro === "semana"}
          href="/app/eventos?filtro=semana"
        />
        <FilterChip
          label="Só VIP"
          active={filtro === "vip"}
          href="/app/eventos?filtro=vip"
        />
      </div>

      {eventos.length === 0 && <EmptyEventos filtroAtivo={!!filtro} />}

      {destaque && (
        <section className="pt-5">
          <EventoDestaque
            evento={destaque}
            capa={fotoMap.get(destaque.id) ?? null}
            confirmado={confirmados.has(destaque.id)}
          />
        </section>
      )}

      {outros.length > 0 && (
        <section className="pt-6">
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 10,
            }}
          >
            Próximos
          </div>
          <div className="flex flex-col gap-2.5">
            {outros.map((e) => (
              <EventoCard
                key={e.id}
                evento={e}
                capa={fotoMap.get(e.id) ?? null}
                confirmado={confirmados.has(e.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={active ? "chip gold" : "chip"}
      style={{
        whiteSpace: "nowrap",
        flexShrink: 0,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </Link>
  );
}

function EventoDestaque({
  evento,
  capa,
  confirmado,
}: {
  evento: EventoRow;
  capa: string | null;
  confirmado: boolean;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line-strong)",
      }}
    >
      {/* Banner — limpo, só com os badges flutuantes (sem texto/gradiente
          sobreposto). Todas as infos vão pro painel de baixo. */}
      <Link
        href={`/app/eventos/${evento.id}`}
        className="relative block"
        style={{ height: 200, textDecoration: "none" }}
      >
        {capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={capa}
            alt={evento.titulo}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, rgba(212,175,110,0.35), transparent 55%), linear-gradient(135deg, #2a1810 0%, #0a0706 70%)",
            }}
          />
        )}
        <div
          className="absolute flex items-center gap-1"
          style={{
            top: 12,
            right: 12,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1,
          }}
        >
          ★ EM DESTAQUE
        </div>
        {evento.vip_only && (
          <div
            className="absolute flex items-center gap-1"
            style={{
              top: 12,
              left: 12,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--gold-500)",
              color: "var(--gold-300)",
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            ★ SÓ VIP
          </div>
        )}
        {evento.tipo === "patrocinado" && (
          <div
            className="absolute"
            style={{
              bottom: 12,
              right: 12,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--line-strong)",
              color: "var(--text-1)",
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            Patrocinado
          </div>
        )}
      </Link>

      {/* Painel inferior — todas as infos em texto + botão Confirmar */}
      <div className="flex items-stretch gap-3 p-4">
        <Link
          href={`/app/eventos/${evento.id}`}
          className="min-w-0 flex-1 block"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--gold-300)",
              marginBottom: 4,
            }}
          >
            {formatEventoData(evento.data)}
          </div>
          <div
            className="display"
            style={{
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.2,
              color: "var(--text-0)",
              marginBottom: 6,
            }}
          >
            {evento.titulo}
          </div>
          {(evento.local || evento.cidade) && (
            <div
              className="flex items-center gap-1"
              style={{
                fontSize: 11,
                color: "var(--text-2)",
                marginBottom: 2,
              }}
            >
              <span>📍</span>
              <span className="truncate">
                {[evento.local, evento.cidade].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          {evento.dress_code && (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
              Dress code: {evento.dress_code}
            </div>
          )}
        </Link>
        <div className="flex items-end flex-shrink-0">
          <PresencaButton eventoId={evento.id} confirmado={confirmado} />
        </div>
      </div>
    </div>
  );
}

function EventoCard({
  evento,
  capa,
  confirmado,
}: {
  evento: EventoRow;
  capa: string | null;
  confirmado: boolean;
}) {
  const { dia, mes } = eventoDiaMes(evento.data);
  const hora = eventoHora(evento.data);

  return (
    <div
      className="card flex items-center gap-3 p-3"
      style={{ border: "1px solid var(--line)" }}
    >
      <Link
        href={`/app/eventos/${evento.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
        style={{ textDecoration: "none" }}
      >
        <div
          className="flex flex-col items-center justify-center flex-shrink-0"
          style={{
            width: 58,
            height: 62,
            borderRadius: 12,
            background:
              "linear-gradient(145deg, #f5e6c8 0%, #e4c89a 55%, #c9a775 100%)",
            color: "#2a1a0a",
            boxShadow:
              "inset 0 1px 0 rgba(255,245,220,0.6), 0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{dia}</div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {mes}
          </div>
        </div>
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div
            className="truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}
          >
            {evento.titulo}
          </div>
          {evento.vip_only && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                fontSize: 8,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              VIP
            </span>
          )}
        </div>
        {(evento.local || evento.cidade) && (
          <div
            className="truncate"
            style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}
          >
            {[evento.local, evento.cidade].filter(Boolean).join(" · ")}
          </div>
        )}
        <div
          className="mono truncate"
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 4,
            letterSpacing: 0.5,
          }}
        >
          {hora}h
          {evento.capacidade ? ` · ${evento.capacidade} vagas` : ""}
          {evento.dress_code ? ` · ${evento.dress_code}` : ""}
        </div>
      </div>
        {capa && (
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: "var(--bg-2)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capa}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
      </Link>
      <PresencaButton
        eventoId={evento.id}
        confirmado={confirmado}
        size="small"
        label={{ confirmar: "Ir", confirmado: "✓ Irei" }}
      />
    </div>
  );
}

function EmptyEventos({ filtroAtivo }: { filtroAtivo: boolean }) {
  return (
    <div
      className="mt-10 flex flex-col items-center text-center gap-3 rounded-2xl"
      style={{
        padding: 28,
        background: "var(--bg-1)",
        border: "1px dashed var(--line-strong)",
      }}
    >
      <div
        className="display gold-text"
        style={{ fontSize: 24, fontWeight: 500 }}
      >
        {filtroAtivo ? "Nenhum evento nesse filtro" : "Sem eventos por enquanto"}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        O Admin está montando os próximos encontros. Volta amanhã — ou mexe
        nos filtros pra ver eventos antigos.
      </div>
    </div>
  );
}
