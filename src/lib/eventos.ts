/* ====================================================================
 * Helpers PUROS pra eventos — tipos + formatação de data/hora.
 *
 * IMPORTANTE: este arquivo NÃO pode importar `next/headers` ou
 * `supabase/server`, porque client components também importam daqui
 * (ex.: admin/eventos/eventos-grid.tsx usa eventoDiaMes / eventoHora).
 *
 * Helpers que precisam do client Supabase (resolveEventoFoto*) vivem
 * em `lib/eventos-server.ts`.
 * ================================================================== */

export type EventoTipo = "proprio" | "patrocinado";

export type EventoRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  local: string | null;
  cidade: string | null;
  capacidade: number | null;
  dress_code: string | null;
  tipo: EventoTipo;
  patrocinador_nome: string | null;
  valor_patrocinio: number | null;
  foto_url: string | null;
  vip_only: boolean;
  publicado: boolean;
  destacado: boolean;
  created_at: string;
};

export const EVENTO_COLS =
  "id, titulo, descricao, data, local, cidade, capacidade, dress_code, tipo, patrocinador_nome, valor_patrocinio, foto_url, vip_only, publicado, destacado, created_at";

/**
 * Formata data do evento no timezone America/Sao_Paulo. Ex.:
 *   "Sex, 25 ABR · 22h"
 *   "Hoje · 22h"
 *   "Amanhã · 20h"
 *
 * IMPORTANTE: não usar `new Date(iso).getDate()` / .getHours() direto,
 * porque no server do Vercel (UTC) retorna valores de UTC, não de BRT.
 * Um evento salvo como 16/05 22:00 BRT vira 17/05 01:00 UTC, e
 * getDate() no server devolve 17. Bug clássico.
 */

const TZ = "America/Sao_Paulo";

const MESES_PT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const SEMANAS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function partsInTz(iso: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // Intl weekday "short" em en-CA: Sun, Mon, Tue, ...
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    // "hour" pode vir como "24" em casos raros (em-CA com hour12:false)
    hour: Number.parseInt(get("hour"), 10) % 24,
    minute: Number.parseInt(get("minute"), 10),
    weekday: wdMap[get("weekday")] ?? 0,
  };
}

export function formatEventoData(iso: string): string {
  const p = partsInTz(iso);
  const now = partsInTz(new Date().toISOString());

  const targetDayKey = p.year * 10000 + p.month * 100 + p.day;
  const todayKey = now.year * 10000 + now.month * 100 + now.day;
  const diffDays = dayDiff(
    p.year, p.month, p.day,
    now.year, now.month, now.day,
  );

  const horaLabel =
    p.minute === 0
      ? `${pad(p.hour)}h`
      : `${pad(p.hour)}h${pad(p.minute)}`;

  if (targetDayKey === todayKey) return `Hoje · ${horaLabel}`;
  if (diffDays === 1) return `Amanhã · ${horaLabel}`;
  if (diffDays === -1) return `Ontem · ${horaLabel}`;

  const diaSemana = SEMANAS_PT[p.weekday];
  const mes = MESES_PT[p.month - 1];
  return `${capitalize(diaSemana)}, ${pad(p.day)} ${mes} · ${horaLabel}`;
}

export function eventoDiaMes(iso: string): { dia: string; mes: string } {
  const p = partsInTz(iso);
  return {
    dia: pad(p.day),
    mes: MESES_PT[p.month - 1] ?? "",
  };
}

/**
 * Hora (HH) do evento no timezone BRT, já formatada com zero à esquerda.
 * Útil no card da lista que só mostra "22h" sem o resto.
 */
export function eventoHora(iso: string): string {
  const p = partsInTz(iso);
  return pad(p.hour);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayDiff(
  y1: number, m1: number, d1: number,
  y2: number, m2: number, d2: number,
): number {
  // Diferença de dias entre (y1,m1,d1) e (y2,m2,d2) ignorando horário.
  // Usa Date.UTC só como ferramenta de cálculo — não é afetado por tz.
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t1 - t2) / (24 * 60 * 60 * 1000));
}
