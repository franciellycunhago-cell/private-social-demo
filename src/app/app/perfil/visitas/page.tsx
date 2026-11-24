import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { hasVipAccess } from "@/lib/vip/check";

export const metadata = {
  title: "Quem visitou seu perfil — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/visitas
 *
 * Lista quem visitou o perfil do user logado nos últimos 30 dias.
 * Apenas VIP/admin vê a lista. Free vê paywall com contagem total.
 *
 * Anti-stalking:
 *  - Mostra só "há X dias" (sem hora exata)
 *  - Limite 30 dias atrás
 *  - 1 view por par (visitante, perfil) — visitas repetidas
 *    aparecem com `ultima_visita` mais recente
 * ================================================================== */

type VisitanteRow = {
  visitante_id: string;
  ultima_visita: string;
};

type Profile = {
  id: string;
  nome_exibicao: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string | null;
  estado: string | null;
  idade_1: number | null;
  idade_2: number | null;
  verificado: boolean;
};

type Visita = {
  perfil: Profile;
  capa: string | null;
  ultimaVisita: string;
};

export default async function VisitasPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const isVip = hasVipAccess(info.status.profile.vip_ate, info.isAdmin);

  const supabase = await createClient();
  const trintaDiasAtras = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Conta total (mostra pra free no paywall + pra VIP no header)
  const { count: total } = await supabase
    .from("perfil_views")
    .select("*", { count: "exact", head: true })
    .eq("perfil_id", meId)
    .gte("ultima_visita", trintaDiasAtras);

  const totalVisitas = total ?? 0;

  // Free: só conta no paywall
  if (!isVip) {
    return <PaywallVisitas total={totalVisitas} />;
  }

  // VIP: lista completa
  const { data: viewsRaw } = await supabase
    .from("perfil_views")
    .select("visitante_id, ultima_visita")
    .eq("perfil_id", meId)
    .gte("ultima_visita", trintaDiasAtras)
    .order("ultima_visita", { ascending: false })
    .limit(100);

  const views = (viewsRaw ?? []) as VisitanteRow[];

  let visitas: Visita[] = [];
  if (views.length > 0) {
    const visitanteIds = views.map((v) => v.visitante_id);
    const [profilesRes, fotosRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, nome_exibicao, tipo, cidade, estado, idade_1, idade_2, verificado, suspenso, deletado_em",
        )
        .in("id", visitanteIds),
      supabase
        .from("fotos")
        .select("profile_id, url")
        .in("profile_id", visitanteIds)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);

    type ProfileWithStatus = Profile & {
      suspenso: boolean;
      deletado_em: string | null;
    };

    const profileMap = new Map<string, Profile>();
    ((profilesRes.data ?? []) as ProfileWithStatus[]).forEach((p) => {
      // Esconde suspensos e excluídos
      if (p.suspenso || p.deletado_em) return;
      profileMap.set(p.id, p);
    });

    const fotoMap = new Map<string, string>();
    ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
      (f) => {
        if (!fotoMap.has(f.profile_id)) {
          const { data } = supabase.storage
            .from("fotos-publicas")
            .getPublicUrl(f.url);
          fotoMap.set(f.profile_id, data.publicUrl);
        }
      },
    );

    visitas = views
      .map((v): Visita | null => {
        const perfil = profileMap.get(v.visitante_id);
        if (!perfil) return null;
        return {
          perfil,
          capa: fotoMap.get(v.visitante_id) ?? null,
          ultimaVisita: v.ultima_visita,
        };
      })
      .filter((x): x is Visita => x !== null);
  }

  return (
    <div className="flex flex-col px-5 pt-10 pb-10 max-w-md mx-auto">
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
          Quem visitou seu perfil
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
          {visitas.length}{" "}
          {visitas.length === 1 ? "pessoa nos últimos" : "pessoas nos últimos"}{" "}
          30 dias.{" "}
          <span style={{ color: "var(--gold-300)" }}>★ VIP</span>
        </p>
      </header>

      {visitas.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background:
              "linear-gradient(160deg, rgba(212,175,110,0.10), rgba(212,175,110,0.02))",
            border: "1px solid var(--gold-500)",
          }}
        >
          {visitas.map((v, i) => (
            <VisitanteRowItem
              key={v.perfil.id}
              v={v}
              last={i === visitas.length - 1}
            />
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textAlign: "center",
          marginTop: 24,
          lineHeight: 1.6,
        }}
      >
        Mostrando últimos 30 dias. Cada pessoa aparece 1x — visitas
        repetidas só atualizam a data. Admins navegam invisíveis e não
        aparecem aqui.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function VisitanteRowItem({ v, last }: { v: Visita; last: boolean }) {
  const nome = v.perfil.nome_exibicao ?? "Perfil";
  const cidade = [v.perfil.cidade, v.perfil.estado].filter(Boolean).join(", ");
  const idades = formatIdades(v.perfil.idade_1, v.perfil.idade_2);

  return (
    <Link
      href={`/app/p/${v.perfil.id}`}
      className="flex items-center gap-3 px-4 py-3"
      style={{
        borderBottom: last ? "none" : "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
        }}
      >
        {v.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={v.capa}
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
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div
            className="truncate"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-0)",
            }}
          >
            {nome}
          </div>
          {v.perfil.verificado && (
            <span
              title="Verificado"
              style={{
                fontSize: 10,
                color: "var(--gold-300)",
              }}
            >
              ✓
            </span>
          )}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
        >
          {idades && `${idades} · `}
          {cidade || "Brasil"} · visitou {tempoRelativo(v.ultimaVisita)}
        </div>
      </div>
      <span style={{ color: "var(--text-3)", fontSize: 18 }}>›</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center text-center gap-2"
      style={{ padding: "48px 16px" }}
    >
      <div style={{ fontSize: 32 }}>👀</div>
      <div
        className="display"
        style={{ fontSize: 18, fontWeight: 500, color: "var(--text-1)" }}
      >
        Ninguém visitou ainda
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        Quando alguém abrir seu perfil, aparece aqui — mesmo antes de
        curtir.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function PaywallVisitas({ total }: { total: number }) {
  return (
    <div className="flex flex-col px-5 pt-10 pb-10">
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
          👀
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
          {total > 0
            ? `${total} ${total === 1 ? "pessoa visitou" : "pessoas visitaram"} seu perfil`
            : "Quem visitou seu perfil"}
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-2)",
            lineHeight: 1.55,
            maxWidth: 320,
          }}
        >
          {total > 0
            ? "Vire VIP e veja exatamente quem está te observando — antes de você decidir curtir de volta."
            : "Quando alguém visitar seu perfil, vai aparecer aqui pra você. Vire VIP pra ver os nomes."}
        </p>

        {/* Preview borrado */}
        <div
          className="rounded-2xl mt-2"
          style={{
            width: "100%",
            maxWidth: 360,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            padding: 14,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              filter: "blur(7px)",
              opacity: 0.6,
              pointerEvents: "none",
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3"
                style={{
                  padding: "8px 0",
                  borderBottom:
                    i === 3 ? "none" : "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--gold-500), var(--bg-2))",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 10,
                      width: "60%",
                      background: "var(--text-3)",
                      borderRadius: 4,
                      marginBottom: 5,
                    }}
                  />
                  <div
                    style={{
                      height: 8,
                      width: "40%",
                      background: "var(--text-3)",
                      borderRadius: 4,
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,4,2,0.4), rgba(8,4,2,0.85))",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--gold-300)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              ★ Conteúdo VIP
            </span>
          </div>
        </div>

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

/* ─────────────────────────────────────────────────────────────────── */

function formatIdades(a: number | null, b: number | null): string {
  if (a && b) return `${a}·${b}`;
  if (a) return `${a}`;
  return "";
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "agora há pouco";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "há 1 semana";
  if (weeks < 5) return `há ${weeks} semanas`;
  return `há ${Math.floor(days / 30)} mês`;
}
