import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Assinaturas — Admin",
};

/* ====================================================================
 * /admin/assinaturas
 *
 *  Funil de conversão (vip_eventos):
 *    page_visitada → trial_iniciado → pagamento_confirmado
 *    + cancelamentos
 *
 *  KPIs financeiros:
 *    - MRR estimado (assinantes ativos × valor mensal)
 *    - Total de assinantes ativos
 *    - Em trial
 *    - Cancelamentos no mês
 *
 *  Lista de assinantes ativos com filtro por status/plano
 * ================================================================== */

type AssinaturaRow = {
  id: string;
  profile_id: string;
  plano: "mensal" | "trimestral" | "anual";
  valor_centavos: number;
  status: "trial" | "ativa" | "inadimplente" | "cancelada" | "expirada";
  ativada_em: string | null;
  expira_em: string | null;
  cancelada_em: string | null;
  trial_fim_em: string | null;
  created_at: string;
};

type ProfileLite = {
  id: string;
  nome_exibicao: string | null;
  handle: string | null;
};

type SearchParams = Promise<{ status?: string }>;

export default async function AdminAssinaturasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filtroStatus = params.status ?? "todas";

  const admin = adminClient();

  const trintaDiasAtras = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── Eventos do funil (últimos 30 dias) ──────────────────────────
  const [
    pageVisitadasRes,
    trialsIniciadosRes,
    pagamentosConfirmadosRes,
    canceladosTrialRes,
    canceladosPosTrialRes,
  ] = await Promise.all([
    admin
      .from("vip_eventos")
      .select("profile_id", { count: "exact", head: true })
      .eq("tipo", "page_visitada")
      .gte("created_at", trintaDiasAtras),
    admin
      .from("vip_eventos")
      .select("profile_id", { count: "exact", head: true })
      .eq("tipo", "trial_iniciado")
      .gte("created_at", trintaDiasAtras),
    admin
      .from("vip_eventos")
      .select("profile_id", { count: "exact", head: true })
      .eq("tipo", "pagamento_confirmado")
      .gte("created_at", trintaDiasAtras),
    admin
      .from("vip_eventos")
      .select("profile_id", { count: "exact", head: true })
      .eq("tipo", "cancelado_no_trial")
      .gte("created_at", trintaDiasAtras),
    admin
      .from("vip_eventos")
      .select("profile_id", { count: "exact", head: true })
      .eq("tipo", "cancelado_pos_trial")
      .gte("created_at", trintaDiasAtras),
  ]);

  const visitas = pageVisitadasRes.count ?? 0;
  const trials = trialsIniciadosRes.count ?? 0;
  const pagos = pagamentosConfirmadosRes.count ?? 0;
  const cancTrial = canceladosTrialRes.count ?? 0;
  const cancPos = canceladosPosTrialRes.count ?? 0;

  // ── Assinaturas ativas (e por status) ───────────────────────────
  let q = admin
    .from("assinaturas")
    .select(
      "id, profile_id, plano, valor_centavos, status, ativada_em, expira_em, cancelada_em, trial_fim_em, created_at",
    );

  if (filtroStatus !== "todas") {
    q = q.eq("status", filtroStatus);
  }

  const { data: assinaturasRaw } = await q
    .order("created_at", { ascending: false })
    .limit(100);

  const assinaturas = (assinaturasRaw ?? []) as AssinaturaRow[];

  // ── Profiles dos assinantes pra mostrar nome ────────────────────
  const profileIds = Array.from(new Set(assinaturas.map((a) => a.profile_id)));
  let profileMap = new Map<string, ProfileLite>();
  if (profileIds.length > 0) {
    const { data: profilesRes } = await admin
      .from("profiles")
      .select("id, nome_exibicao, handle")
      .in("id", profileIds);
    ((profilesRes ?? []) as ProfileLite[]).forEach((p) =>
      profileMap.set(p.id, p),
    );
  }

  // ── Counts por status (pros chips e KPIs) ───────────────────────
  const [cTrial, cAtiva, cInadimplente, cCancelada, cTotal] = await Promise.all(
    [
      admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true })
        .eq("status", "trial"),
      admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativa"),
      admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true })
        .eq("status", "inadimplente"),
      admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelada"),
      admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true }),
    ],
  );

  // ── MRR estimado ────────────────────────────────────────────────
  // Soma valor mensal equivalente das assinaturas ativas
  const { data: ativasParaMrr } = await admin
    .from("assinaturas")
    .select("plano, valor_centavos")
    .eq("status", "ativa");

  const mrrCentavos = (
    (ativasParaMrr ?? []) as { plano: string; valor_centavos: number }[]
  ).reduce((acc, a) => {
    const divisor =
      a.plano === "mensal" ? 1 : a.plano === "trimestral" ? 3 : 12;
    return acc + Math.round(a.valor_centavos / divisor);
  }, 0);

  const taxaConversaoTrial = visitas > 0 ? Math.round((trials / visitas) * 100) : 0;
  const taxaConversaoPagamento =
    trials > 0 ? Math.round((pagos / trials) * 100) : 0;
  const taxaCancelamentoTrial =
    trials > 0 ? Math.round((cancTrial / trials) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="display"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Assinaturas
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 560 }}
        >
          Funil de conversão (últimos 30 dias) e estado atual das assinaturas.
        </p>
      </header>

      {/* ── KPIs principais ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi
          label="MRR estimado"
          value={formatCentavos(mrrCentavos)}
          sub="receita mensal recorrente"
          accent
        />
        <Kpi
          label="Ativos"
          value={cAtiva.count ?? 0}
          sub="pagando agora"
        />
        <Kpi
          label="Em trial"
          value={cTrial.count ?? 0}
          sub="período grátis"
        />
        <Kpi
          label="Inadimplentes"
          value={cInadimplente.count ?? 0}
          sub="atraso pagamento"
          warn={(cInadimplente.count ?? 0) > 0}
        />
      </section>

      {/* ── Funil ────────────────────────────────────────────────── */}
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
          Funil — últimos 30 dias
        </h2>

        <div
          className="rounded-2xl"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            padding: 16,
          }}
        >
          <FunnelStep
            label="Visitaram /app/vip"
            value={visitas}
            barWidth={100}
          />
          <FunnelStep
            label="Iniciaram trial"
            value={trials}
            sub={`${taxaConversaoTrial}% das visitas`}
            barWidth={visitas > 0 ? (trials / visitas) * 100 : 0}
          />
          <FunnelStep
            label="Pagaram pós-trial"
            value={pagos}
            sub={`${taxaConversaoPagamento}% dos trials`}
            barWidth={visitas > 0 ? (pagos / visitas) * 100 : 0}
            highlight
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <Kpi
            label="Cancelaram no trial"
            value={cancTrial}
            sub={`${taxaCancelamentoTrial}% dos trials`}
            warn={taxaCancelamentoTrial > 50}
          />
          <Kpi
            label="Cancelaram pós-pago"
            value={cancPos}
            sub="churn de pagantes"
            warn={cancPos > 0}
          />
        </div>
      </section>

      {/* ── Filtro + Lista ───────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
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
            Assinaturas
          </h2>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: "var(--text-3)",
            }}
          >
            {assinaturas.length} de {cTotal.count ?? 0}
          </span>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <FilterChip label="Todas" status="todas" current={filtroStatus} />
          <FilterChip label="Ativas" status="ativa" current={filtroStatus} />
          <FilterChip label="Trial" status="trial" current={filtroStatus} />
          <FilterChip
            label="Inadimplentes"
            status="inadimplente"
            current={filtroStatus}
            tone="warn"
          />
          <FilterChip
            label="Canceladas"
            status="cancelada"
            current={filtroStatus}
            tone="muted"
          />
        </div>

        {assinaturas.length === 0 ? (
          <div
            className="card flex flex-col items-center text-center gap-2"
            style={{ padding: 36 }}
          >
            <div style={{ fontSize: 32 }}>📭</div>
            <div style={{ fontSize: 14, color: "var(--text-1)" }}>
              {filtroStatus === "todas"
                ? "Ainda não há assinaturas. O VIP foi lançado recentemente."
                : "Nenhuma assinatura nesse status."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {assinaturas.map((a) => (
              <AssinaturaRow
                key={a.id}
                a={a}
                perfil={profileMap.get(a.profile_id) ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const cor = accent
    ? { fg: "var(--gold-300)", border: "var(--gold-500)", bg: "rgba(212,175,110,0.08)" }
    : warn
      ? { fg: "var(--rose-400)", border: "rgba(217,138,114,0.4)", bg: "rgba(217,138,114,0.06)" }
      : { fg: "var(--text-0)", border: "var(--line)", bg: "var(--bg-1)" };

  return (
    <div
      className="rounded-xl"
      style={{
        background: cor.bg,
        border: `1px solid ${cor.border}`,
        padding: 14,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        className="display"
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: cor.fg,
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  sub,
  barWidth,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  barWidth: number;
  highlight?: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-1">
        <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500 }}>
          {label}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: highlight ? "var(--gold-300)" : "var(--text-0)",
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(2, Math.min(100, barWidth))}%`,
            height: "100%",
            background: highlight
              ? "var(--shine-gold)"
              : "rgba(212,175,110,0.5)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  status,
  current,
  tone,
}: {
  label: string;
  status: string;
  current: string;
  tone?: "warn" | "muted";
}) {
  const active = current === status;
  const cor =
    tone === "warn"
      ? { fg: "var(--rose-400)", border: "rgba(217,138,114,0.5)" }
      : tone === "muted"
        ? { fg: "var(--text-3)", border: "var(--line-strong)" }
        : { fg: "var(--gold-300)", border: "var(--gold-600)" };

  const href =
    status === "todas"
      ? "/admin/assinaturas"
      : `/admin/assinaturas?status=${status}`;

  return (
    <Link
      href={href}
      className="mono"
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? cor.border : "var(--line)"}`,
        background: active
          ? tone === "warn"
            ? "rgba(217,138,114,0.1)"
            : tone === "muted"
              ? "rgba(255,255,255,0.04)"
              : "rgba(212,175,110,0.12)"
          : "transparent",
        color: active ? cor.fg : "var(--text-2)",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontWeight: active ? 700 : 500,
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

function AssinaturaRow({
  a,
  perfil,
}: {
  a: AssinaturaRow;
  perfil: ProfileLite | null;
}) {
  const planoLabel: Record<typeof a.plano, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    anual: "Anual",
  };

  const statusCor: Record<typeof a.status, React.CSSProperties> = {
    trial: { color: "var(--gold-300)", borderColor: "var(--gold-500)" },
    ativa: {
      color: "oklch(0.82 0.09 140)",
      borderColor: "rgba(149,176,115,0.5)",
    },
    inadimplente: {
      color: "var(--rose-400)",
      borderColor: "rgba(217,138,114,0.5)",
    },
    cancelada: { color: "var(--text-3)", borderColor: "var(--line-strong)" },
    expirada: { color: "var(--text-3)", borderColor: "var(--line)" },
  };

  const statusLabel: Record<typeof a.status, string> = {
    trial: "TRIAL",
    ativa: "ATIVA",
    inadimplente: "INADIMPLENTE",
    cancelada: "CANCELADA",
    expirada: "EXPIRADA",
  };

  const expiraIn = a.expira_em
    ? Math.ceil(
        (new Date(a.expira_em).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <Link
      href={perfil ? `/admin/usuarios/${a.profile_id}` : "#"}
      className="card flex items-center gap-3"
      style={{ padding: 12, textDecoration: "none" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="display"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)" }}
          >
            {perfil?.nome_exibicao ?? "Perfil removido"}
          </span>
          {perfil?.handle && (
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--text-3)" }}
            >
              @{perfil.handle}
            </span>
          )}
          <span
            className="chip"
            style={{
              fontSize: 9,
              padding: "2px 8px",
              fontWeight: 700,
              letterSpacing: 1,
              ...statusCor[a.status],
            }}
          >
            {statusLabel[a.status]}
          </span>
        </div>
        <div
          style={{ fontSize: 11, color: "var(--text-2)", marginTop: 3 }}
        >
          {planoLabel[a.plano]} · {formatCentavos(a.valor_centavos)}
          {expiraIn !== null && a.status !== "cancelada" && (
            <>
              {" · "}
              {expiraIn > 0
                ? `expira em ${expiraIn}d`
                : `vencida há ${-expiraIn}d`}
            </>
          )}
        </div>
      </div>
      {perfil && <span style={{ color: "var(--text-3)", fontSize: 18 }}>›</span>}
    </Link>
  );
}

function formatCentavos(c: number): string {
  return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
}
