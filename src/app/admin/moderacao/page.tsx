import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModerationRow } from "./moderation-row";

export const metadata = {
  title: "Moderação — Admin",
};

/* ====================================================================
 * /admin/moderacao
 * - Fila de verificações pendentes (oldest first)
 * - 5 últimas resolvidas (aprovado/rejeitado)
 * - Cada linha renderiza MiniReviewCard (client) com signed URL da selfie
 * ================================================================== */

type VerifQueueRow = {
  id: string;
  profile_id: string;
  foto_url: string;
  status: "pendente" | "aprovado" | "rejeitado";
  motivo_rejeicao: string | null;
  revisado_em: string | null;
  created_at: string;
  profiles: {
    nome_exibicao: string | null;
    tipo: "casal" | "homem" | "mulher" | null;
    cidade: string | null;
    estado: string | null;
    idade_1: number | null;
    idade_2: number | null;
    bio: string | null;
  } | null;
};

export default async function ModeracaoPage() {
  const supabase = await createClient();

  const [pendingRes, recentRes, statsRes] = await Promise.all([
    supabase
      .from("verificacoes")
      .select(
        "id, profile_id, foto_url, status, motivo_rejeicao, revisado_em, created_at, profiles!verificacoes_profile_id_fkey(nome_exibicao, tipo, cidade, estado, idade_1, idade_2, bio)",
      )
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(40),
    supabase
      .from("verificacoes")
      .select(
        "id, profile_id, foto_url, status, motivo_rejeicao, revisado_em, created_at, profiles!verificacoes_profile_id_fkey(nome_exibicao, tipo, cidade, estado, idade_1, idade_2, bio)",
      )
      .in("status", ["aprovado", "rejeitado"])
      .order("revisado_em", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("verificacoes")
      .select("status", { count: "exact" }),
  ]);

  const pending = (pendingRes.data ?? []) as unknown as VerifQueueRow[];
  const recent = (recentRes.data ?? []) as unknown as VerifQueueRow[];

  // Gera signed URLs server-side (10 min) pros thumbs da fila
  const signedUrls = new Map<string, string | null>();
  if (pending.length > 0) {
    const { data: signed } = await supabase.storage
      .from("verificacoes")
      .createSignedUrls(
        pending.map((p) => p.foto_url),
        60 * 10,
      );
    (signed ?? []).forEach((item) => {
      if (item?.path) signedUrls.set(item.path, item.signedUrl ?? null);
    });
  }

  // Estatísticas simples
  const statsRows = (statsRes.data ?? []) as { status: string }[];
  const aprovadosTotal = statsRows.filter((r) => r.status === "aprovado").length;
  const rejeitadosTotal = statsRows.filter((r) => r.status === "rejeitado").length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="display"
            style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            Moderação
          </h1>
          <p
            className="mt-1"
            style={{ fontSize: 13, color: "var(--text-2)" }}
          >
            Fila de verificações · aprove ou peça nova selfie
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5" style={{ minWidth: 340 }}>
          <Stat label="Pendentes" value={pending.length} accent />
          <Stat label="Aprovadas" value={aprovadosTotal} />
          <Stat label="Rejeitadas" value={rejeitadosTotal} />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2
            className="display"
            style={{ fontSize: 18, fontWeight: 600 }}
          >
            Fila pendente
          </h2>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {pending.length} aguardando
          </span>
        </div>

        {pending.length === 0 ? (
          <EmptyState
            title="Tudo em dia"
            subtitle="Nenhuma verificação pendente neste momento."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((v) => (
              <ModerationRow
                key={v.id}
                row={v}
                signedUrl={signedUrls.get(v.foto_url) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2
          className="display"
          style={{ fontSize: 18, fontWeight: 600 }}
        >
          Revisões recentes
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            title="Sem histórico ainda"
            subtitle="As últimas aprovações aparecerão aqui."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((v) => (
              <RecentRow key={v.id} row={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-3"
      style={
        accent
          ? {
              background:
                "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))",
              borderColor: "var(--gold-500)",
            }
          : undefined
      }
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </div>
      <div
        className="display mt-1"
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: accent ? "var(--gold-300)" : "var(--text-0)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="card flex flex-col items-center justify-center gap-2 py-10 text-center"
    >
      <div
        className="display"
        style={{ fontSize: 36, color: "var(--gold-600)" }}
      >
        ✓
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-3)" }}>{subtitle}</div>
    </div>
  );
}

function RecentRow({ row }: { row: VerifQueueRow }) {
  const when = row.revisado_em
    ? new Date(row.revisado_em).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
  const nome = row.profiles?.nome_exibicao ?? "Perfil sem nome";

  return (
    <Link
      href={`/admin/usuarios/${row.profile_id}`}
      className="card flex items-center justify-between gap-3 px-4 py-3"
      style={{
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}
        >
          {nome}
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--text-3)" }}
        >
          {when}
          {row.status === "rejeitado" && row.motivo_rejeicao
            ? ` · ${row.motivo_rejeicao}`
            : ""}
        </div>
      </div>
      <span
        className="chip"
        style={
          row.status === "aprovado"
            ? {
                background: "rgba(149, 176, 115, 0.15)",
                color: "oklch(0.82 0.09 140)",
                borderColor: "rgba(149, 176, 115, 0.4)",
              }
            : {
                background: "rgba(217, 138, 114, 0.12)",
                color: "var(--rose-400)",
                borderColor: "rgba(217, 138, 114, 0.4)",
              }
        }
      >
        {row.status === "aprovado" ? "Aprovado" : "Rejeitado"}
      </span>
      <span style={{ color: "var(--text-3)", fontSize: 16 }}>›</span>
    </Link>
  );
}
