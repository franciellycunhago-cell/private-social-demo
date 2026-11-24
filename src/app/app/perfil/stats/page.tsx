import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { hasVipAccess } from "@/lib/vip/check";

export const metadata = {
  title: "Estatísticas do perfil — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/stats
 *
 * Stats agregadas do perfil — VIP only.
 *  - Curtidas recebidas (total + últimos 7 dias)
 *  - Curtidas enviadas → match (taxa de conversão)
 *  - Total de matches
 *  - Pedidos de privado recebidos (total + aprovados)
 *  - Likes recebidos nos posts
 *  - Comentários recebidos nos posts
 *  - Visualizações de stories (somatório dos stories ativos)
 *
 * Free vê paywall com CTA pra /app/vip.
 * ================================================================== */

export default async function StatsPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  // Admin sempre tem acesso VIP (sem assinatura)
  const isVip = hasVipAccess(info.status.profile.vip_ate, info.isAdmin);

  if (!isVip) return <PaywallStats />;

  const supabase = await createClient();

  const seteDiasAtras = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    curtidasRecebidasRes,
    curtidasRecebidasSemanaRes,
    curtidasEnviadasRes,
    matchesRes,
    pedidosRecebidosRes,
    pedidosAprovadosRes,
    postsLikesRes,
    postsComentariosRes,
    storiesViewsRes,
    matchesSemanaRes,
    visitasSemanaRes,
  ] = await Promise.all([
    supabase
      .from("curtidas")
      .select("*", { count: "exact", head: true })
      .eq("para_id", meId),
    supabase
      .from("curtidas")
      .select("*", { count: "exact", head: true })
      .eq("para_id", meId)
      .gte("created_at", seteDiasAtras),
    supabase
      .from("curtidas")
      .select("*", { count: "exact", head: true })
      .eq("de_id", meId),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`),
    supabase
      .from("pedidos_privado")
      .select("*", { count: "exact", head: true })
      .eq("alvo_id", meId),
    supabase
      .from("pedidos_privado")
      .select("*", { count: "exact", head: true })
      .eq("alvo_id", meId)
      .eq("status", "aprovado"),
    // Likes recebidos em todos os meus posts: soma de likes_count
    supabase.from("posts").select("likes_count").eq("profile_id", meId),
    // Comentários recebidos: soma de comentarios_count
    supabase
      .from("posts")
      .select("comentarios_count")
      .eq("profile_id", meId),
    // Views de stories ativos
    supabase
      .from("stories")
      .select("id")
      .eq("profile_id", meId)
      .gt("expires_at", new Date().toISOString()),
    // Matches da última semana
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`)
      .gte("created_at", seteDiasAtras),
    // Visitas no perfil (semana + 30d)
    supabase
      .from("perfil_views")
      .select("*", { count: "exact", head: true })
      .eq("perfil_id", meId)
      .gte("ultima_visita", seteDiasAtras),
  ]);

  const curtidasRecebidasTotal = curtidasRecebidasRes.count ?? 0;
  const curtidasRecebidasSemana = curtidasRecebidasSemanaRes.count ?? 0;
  const curtidasEnviadas = curtidasEnviadasRes.count ?? 0;
  const matches = matchesRes.count ?? 0;
  const pedidosRecebidos = pedidosRecebidosRes.count ?? 0;
  const pedidosAprovados = pedidosAprovadosRes.count ?? 0;
  const matchesSemana = matchesSemanaRes.count ?? 0;
  const visitasSemana = visitasSemanaRes.count ?? 0;

  const totalLikesPosts = (
    (postsLikesRes.data ?? []) as { likes_count: number }[]
  ).reduce((acc, p) => acc + (p.likes_count ?? 0), 0);

  const totalComentariosPosts = (
    (postsComentariosRes.data ?? []) as { comentarios_count: number }[]
  ).reduce((acc, p) => acc + (p.comentarios_count ?? 0), 0);

  // Conta views dos meus stories ativos
  const storyIds = ((storiesViewsRes.data ?? []) as { id: string }[]).map(
    (s) => s.id,
  );
  let storiesViewsCount = 0;
  if (storyIds.length > 0) {
    const { count } = await supabase
      .from("stories_views")
      .select("*", { count: "exact", head: true })
      .in("story_id", storyIds);
    storiesViewsCount = count ?? 0;
  }

  // Taxa de match das curtidas enviadas (% que viraram match)
  const taxaMatch =
    curtidasEnviadas > 0
      ? Math.round((matches / curtidasEnviadas) * 100)
      : 0;

  // Taxa de aprovação dos pedidos privados
  const taxaAprovacaoPriv =
    pedidosRecebidos > 0
      ? Math.round((pedidosAprovados / pedidosRecebidos) * 100)
      : 0;

  return (
    <div className="flex flex-col px-5 pt-10 pb-20 max-w-md mx-auto">
      <Link
        href="/app/perfil"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        ‹ Perfil
      </Link>

      <header className="mb-5">
        <h1
          className="display"
          style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          Estatísticas
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
          Como seu perfil está performando.{" "}
          <span style={{ color: "var(--gold-300)" }}>★ VIP</span>
        </p>
      </header>

      <Section title="Esta semana">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label="Visitas no perfil"
            value={visitasSemana}
            sub="últimos 7 dias"
            accent={visitasSemana > 0}
          />
          <KpiCard
            label="Curtidas recebidas"
            value={curtidasRecebidasSemana}
            sub="últimos 7 dias"
            accent={curtidasRecebidasSemana > 0}
          />
          <KpiCard
            label="Matches novos"
            value={matchesSemana}
            sub="últimos 7 dias"
            accent={matchesSemana > 0}
          />
        </div>
      </Section>

      <Section title="Geral">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label="Curtidas recebidas"
            value={curtidasRecebidasTotal}
            sub="histórico total"
          />
          <KpiCard
            label="Matches"
            value={matches}
            sub="conexões mútuas"
          />
          <KpiCard
            label="Curtidas enviadas"
            value={curtidasEnviadas}
            sub="por você"
          />
          <KpiCard
            label="Taxa de match"
            value={`${taxaMatch}%`}
            sub="das suas curtidas"
            accent={taxaMatch >= 30}
          />
        </div>
      </Section>

      <Section title="Posts">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label="Likes em posts"
            value={totalLikesPosts}
            sub="soma de todos"
          />
          <KpiCard
            label="Comentários"
            value={totalComentariosPosts}
            sub="soma de todos"
          />
        </div>
      </Section>

      {storyIds.length > 0 && (
        <Section title="Stories ativos">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard
              label="Stories"
              value={storyIds.length}
              sub="ativos agora"
            />
            <KpiCard
              label="Visualizações"
              value={storiesViewsCount}
              sub="dos stories ativos"
            />
          </div>
        </Section>
      )}

      <Section title="Privado">
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            label="Pedidos recebidos"
            value={pedidosRecebidos}
            sub="histórico"
          />
          <KpiCard
            label="Aprovados"
            value={`${taxaAprovacaoPriv}%`}
            sub={`${pedidosAprovados} de ${pedidosRecebidos}`}
          />
        </div>
      </Section>

      <p
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.6,
        }}
      >
        Estatísticas atualizadas em tempo real. Última atualização:{" "}
        {new Date().toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-2)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))"
          : "var(--bg-1)",
        border: accent
          ? "1px solid var(--gold-500)"
          : "1px solid var(--line)",
        padding: 14,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: accent ? "var(--gold-300)" : "var(--text-3)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        className="display"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: accent ? "var(--gold-300)" : "var(--text-0)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function PaywallStats() {
  return (
    <div className="flex flex-col px-5 pt-10 pb-20">
      <Link
        href="/app/perfil"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        ‹ Perfil
      </Link>

      <div className="flex flex-col items-center text-center gap-4 pt-8">
        <div
          className="flex items-center justify-center"
          style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontSize: 40,
          }}
        >
          📊
        </div>

        <div
          className="display gold-text"
          style={{
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            maxWidth: 320,
          }}
        >
          Saiba como seu perfil está
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-2)",
            lineHeight: 1.55,
            maxWidth: 320,
          }}
        >
          Visitas na semana, total de likes recebidos, taxa de match das
          suas curtidas, performance dos posts e stories. Tudo num só
          lugar — só pra VIP.
        </p>

        <Link
          href="/app/vip"
          className="btn-gold mt-4"
          style={{
            padding: "13px 28px",
            fontSize: 13,
            textDecoration: "none",
            letterSpacing: 1,
          }}
        >
          Vire VIP por R$ 9,90/mês
        </Link>
        <div
          style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}
        >
          7 dias grátis · cancela a hora que quiser
        </div>
      </div>
    </div>
  );
}
