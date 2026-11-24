import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PageHeading } from "@/components/page-heading";
import { hasVipAccess } from "@/lib/vip/check";

export const metadata = {
  title: "Meus matches — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/curtidas?tab=enviadas|recebidas
 *
 * Tab "Enviadas" (default, free + VIP):
 *  - Quem você curtiu, agrupado em "match mútuo" e "aguardando"
 *
 * Tab "Recebidas" (só VIP):
 *  - Quem te curtiu (mesmo sem match ainda)
 *  - Free vê paywall com CTA pra /app/vip
 *
 * RLS de curtidas garante que só VIP pode ler `curtidas` onde
 * para_id = self (policy "curtidas_select_envolvido" da migration
 * inicial — atualizada pra usar vip_ate em 20260426000008)
 * ================================================================== */

type SearchParams = Promise<{ tab?: string }>;

type CurtidaRow = {
  para_id: string;
  tipo: "like" | "super";
  created_at: string;
};

type CurtidaRecebidaRow = {
  de_id: string;
  tipo: "like" | "super";
  created_at: string;
};

type OtherProfile = {
  id: string;
  nome_exibicao: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string | null;
  estado: string | null;
  idade_1: number | null;
  idade_2: number | null;
  verificado: boolean;
};

type MatchRow = {
  id: string;
  profile_1: string;
  profile_2: string;
};

type Item = {
  curtida: { tipo: "like" | "super"; created_at: string };
  perfil: OtherProfile;
  capa: string | null;
  matchId: string | null;
};

export default async function CurtidasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const params = await searchParams;
  const tab = params.tab === "recebidas" ? "recebidas" : "enviadas";

  // Admin sempre tem acesso VIP (sem assinatura)
  const isVip = hasVipAccess(info.status.profile.vip_ate, info.isAdmin);

  const supabase = await createClient();

  // === TAB RECEBIDAS ===
  if (tab === "recebidas") {
    if (!isVip) {
      return <PaywallRecebidas />;
    }

    const { data: recebidasRaw } = await supabase
      .from("curtidas")
      .select("de_id, tipo, created_at")
      .eq("para_id", meId)
      .order("created_at", { ascending: false })
      .limit(200);

    const recebidas = (recebidasRaw ?? []) as CurtidaRecebidaRow[];
    return (
      <CurtidasListagem
        meId={meId}
        items={await resolveItems(
          recebidas.map((r) => ({
            outroId: r.de_id,
            tipo: r.tipo,
            createdAt: r.created_at,
          })),
          meId,
          supabase,
        )}
        tab="recebidas"
        isVip={isVip}
      />
    );
  }

  // === TAB ENVIADAS (default) ===
  const { data: curtidasRaw } = await supabase
    .from("curtidas")
    .select("para_id, tipo, created_at")
    .eq("de_id", meId)
    .order("created_at", { ascending: false })
    .limit(200);

  const curtidas = (curtidasRaw ?? []) as CurtidaRow[];

  return (
    <CurtidasListagem
      meId={meId}
      items={await resolveItems(
        curtidas.map((c) => ({
          outroId: c.para_id,
          tipo: c.tipo,
          createdAt: c.created_at,
        })),
        meId,
        supabase,
      )}
      tab="enviadas"
      isVip={isVip}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────── */

async function resolveItems(
  raw: { outroId: string; tipo: "like" | "super"; createdAt: string }[],
  meId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Item[]> {
  if (raw.length === 0) return [];

  const ids = Array.from(new Set(raw.map((r) => r.outroId)));

  const [profilesRes, fotosRes, matchesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, nome_exibicao, tipo, cidade, estado, idade_1, idade_2, verificado",
      )
      .in("id", ids),
    supabase
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", ids)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
    supabase
      .from("matches")
      .select("id, profile_1, profile_2")
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`),
  ]);

  const profileMap = new Map<string, OtherProfile>();
  ((profilesRes.data ?? []) as OtherProfile[]).forEach((p) =>
    profileMap.set(p.id, p),
  );

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

  const matchByOther = new Map<string, string>();
  ((matchesRes.data ?? []) as MatchRow[]).forEach((m) => {
    const other = m.profile_1 === meId ? m.profile_2 : m.profile_1;
    matchByOther.set(other, m.id);
  });

  return raw
    .map((r): Item | null => {
      const perfil = profileMap.get(r.outroId);
      if (!perfil) return null;
      return {
        curtida: { tipo: r.tipo, created_at: r.createdAt },
        perfil,
        capa: fotoMap.get(r.outroId) ?? null,
        matchId: matchByOther.get(r.outroId) ?? null,
      };
    })
    .filter((x): x is Item => x !== null);
}

/* ─────────────────────────────────────────────────────────────────── */

function CurtidasListagem({
  items,
  tab,
  isVip,
}: {
  meId: string;
  items: Item[];
  tab: "enviadas" | "recebidas";
  isVip: boolean;
}) {
  const matched = items.filter((i) => i.matchId);
  const aguardando = items.filter((i) => !i.matchId);
  const supers = items.filter((i) => i.curtida.tipo === "super").length;

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

      <PageHeading
        title="Meus matches"
        subtitle={
          tab === "recebidas"
            ? `${items.length} ${
                items.length === 1 ? "pessoa" : "pessoas"
              } te curtiu${items.length === 1 ? "" : "ram"}`
            : [
                `${items.length} ${items.length === 1 ? "pessoa" : "pessoas"}`,
                supers > 0 ? `${supers} super` : null,
                matched.length > 0
                  ? `${matched.length} confirmado${
                      matched.length > 1 ? "s" : ""
                    }`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
        }
      />

      <TabSwitch tab={tab} isVip={isVip} />

      {items.length === 0 ? (
        <EmptyState tab={tab} />
      ) : tab === "recebidas" ? (
        <Section title={`Te curtiu (${items.length})`}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(160deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
              border: "1px solid var(--gold-500)",
            }}
          >
            {items.map((item, i) => (
              <CurtidaRowItem
                key={item.perfil.id}
                item={item}
                last={i === items.length - 1}
              />
            ))}
          </div>
        </Section>
      ) : (
        <>
          {matched.length > 0 && (
            <Section title={`Match mútuo (${matched.length})`}>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background:
                    "linear-gradient(160deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
                  border: "1px solid var(--line-strong)",
                }}
              >
                {matched.map((item, i) => (
                  <CurtidaRowItem
                    key={item.perfil.id}
                    item={item}
                    last={i === matched.length - 1}
                  />
                ))}
              </div>
            </Section>
          )}

          {aguardando.length > 0 && (
            <Section title={`Aguardando retorno (${aguardando.length})`}>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                }}
              >
                {aguardando.map((item, i) => (
                  <CurtidaRowItem
                    key={item.perfil.id}
                    item={item}
                    last={i === aguardando.length - 1}
                  />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function TabSwitch({
  tab,
  isVip,
}: {
  tab: "enviadas" | "recebidas";
  isVip: boolean;
}) {
  return (
    <div
      className="flex gap-2 mt-3"
      style={{
        borderBottom: "1px solid var(--line)",
        paddingBottom: 0,
      }}
    >
      <TabLink active={tab === "enviadas"} href="/app/perfil/curtidas">
        Enviadas
      </TabLink>
      <TabLink
        active={tab === "recebidas"}
        href="/app/perfil/curtidas?tab=recebidas"
        showLock={!isVip}
      >
        Recebidas
      </TabLink>
    </div>
  );
}

function TabLink({
  active,
  href,
  showLock,
  children,
}: {
  active: boolean;
  href: string;
  showLock?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 14px",
        marginBottom: -1,
        borderBottom: active
          ? "2px solid var(--gold-300)"
          : "2px solid transparent",
        color: active ? "var(--gold-300)" : "var(--text-2)",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
      {showLock && <span style={{ fontSize: 11 }}>🔒</span>}
    </Link>
  );
}

function EmptyState({ tab }: { tab: "enviadas" | "recebidas" }) {
  return (
    <div
      className="flex flex-col items-center text-center gap-2"
      style={{ padding: "48px 16px" }}
    >
      <div style={{ fontSize: 32 }}>{tab === "recebidas" ? "💝" : "♥"}</div>
      <div
        className="display"
        style={{ fontSize: 18, fontWeight: 500, color: "var(--text-1)" }}
      >
        {tab === "recebidas"
          ? "Ainda não recebeu curtidas"
          : "Nenhum match enviado"}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        {tab === "recebidas"
          ? "Quando alguém te curtir, aparece aqui — mesmo antes de virar match."
          : "Quando você curtir alguém no Descobrir, aparece aqui enquanto espera o retorno."}
      </div>
      {tab === "enviadas" && (
        <Link
          href="/app/descobrir"
          className="btn-gold mt-3"
          style={{ padding: "11px 22px", textDecoration: "none" }}
        >
          Ir pra Descobrir
        </Link>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function PaywallRecebidas() {
  return (
    <div className="flex flex-col px-5 pt-10 pb-10">
      <Link
        href="/app/perfil/curtidas"
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
        ‹ Voltar
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
            boxShadow: "0 0 40px rgba(212,175,110,0.35)",
          }}
        >
          🔒
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
          Quem te curtiu antes de você decidir
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-2)",
            lineHeight: 1.55,
            maxWidth: 320,
          }}
        >
          Os usuários VIP veem todo mundo que enviou curtida pra eles —
          mesmo sem ter dado match ainda. Você decide se curte de volta.
        </p>

        {/* Preview borrado pra teaser */}
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-6">
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-2)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function CurtidaRowItem({ item, last }: { item: Item; last: boolean }) {
  const nome = item.perfil.nome_exibicao ?? "Perfil";
  const cidade = [item.perfil.cidade, item.perfil.estado]
    .filter(Boolean)
    .join(", ");
  const idades = formatIdades(item.perfil.idade_1, item.perfil.idade_2);
  const href = item.matchId
    ? `/app/conversas/${item.matchId}`
    : `/app/p/${item.perfil.id}`;

  return (
    <Link
      href={href}
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
        {item.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.capa}
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
          {item.curtida.tipo === "super" && (
            <span
              title="Super curtida"
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                fontSize: 9,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              ★ SUPER
            </span>
          )}
          {item.matchId && (
            <span
              style={{
                background: "rgba(212,175,110,0.14)",
                border: "1px solid var(--gold-500)",
                color: "var(--gold-300)",
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              MATCH
            </span>
          )}
        </div>
        <div
          className="truncate"
          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
        >
          {idades && `${idades} · `}
          {cidade || "Brasil"} · {relativeTime(item.curtida.created_at)}
        </div>
      </div>
      <span style={{ color: "var(--text-3)", fontSize: 18 }}>›</span>
    </Link>
  );
}

function formatIdades(a: number | null, b: number | null): string {
  if (a && b) return `${a}·${b}`;
  if (a) return `${a}`;
  return "";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks}sem`;
  const months = Math.floor(days / 30);
  return `há ${months}m`;
}
