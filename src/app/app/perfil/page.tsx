import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { listPhotosForProfile } from "@/lib/supabase/fotos";
import { loadPostsByProfile } from "@/lib/posts/server";
import { makeViewerToken } from "@/lib/watermark-token";
import { resolveFotoCapa } from "@/lib/foto-capa";
import { PostsTab } from "../p/[id]/posts-tab";
import { DeleteAccountButton } from "./delete-account-button";
import { MeuTokenCard } from "./meu-token-card";
import { CapaEditavel } from "./capa-editavel";
import { signOut } from "../../(auth)/actions";

export const metadata = {
  title: "Meu perfil — PrivateSocial",
};

/* ====================================================================
 * /app/perfil
 *
 * Tela "Meu perfil":
 *  - Header com capa (primeira foto pública, se houver)
 *  - Card de trust score
 *  - CTA VIP (placeholder — Semana 5)
 *  - Stats (curtidas enviadas / matches / fotos)
 *  - Menu de atalhos (editar, fotos, stories, ajustes, sair)
 * ================================================================== */

type SearchParams = Promise<{ post?: string }>;

export default async function MeuPerfilPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");

  const params = await searchParams;
  // Deep link de notificação: /app/perfil?post={id} abre o post no
  // modal automaticamente ("Tom curtiu seu post" → click → vê o post)
  const autoOpenPostId = params.post ?? null;

  const p = info.status.profile;
  const supabase = await createClient();

  const trintaDiasAtras = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    fotosResolved,
    curtidasCount,
    matchesCount,
    meusPosts,
    pedidosPendentesCount,
    visitasCount,
  ] = await Promise.all([
    listPhotosForProfile(p.id),
    supabase
      .from("curtidas")
      .select("*", { count: "exact", head: true })
      .eq("de_id", p.id)
      .then((r) => r.count ?? 0),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`profile_1.eq.${p.id},profile_2.eq.${p.id}`)
      .then((r) => r.count ?? 0),
    loadPostsByProfile(p.id, p.id),
    supabase
      .from("pedidos_privado")
      .select("*", { count: "exact", head: true })
      .eq("alvo_id", p.id)
      .eq("status", "pendente")
      .then((r) => r.count ?? 0),
    supabase
      .from("perfil_views")
      .select("*", { count: "exact", head: true })
      .eq("perfil_id", p.id)
      .gte("ultima_visita", trintaDiasAtras)
      .then((r) => r.count ?? 0),
  ]);

  const fotosPriv = fotosResolved.filter((f) => f.tipo === "privada");
  const capa = await resolveFotoCapa(supabase, p.id, p.foto_capa_path);
  const isVip = p.vip_ate ? new Date(p.vip_ate) > new Date() : false;

  // Opções pra o modal de edição da capa: todas as fotos dos posts do user
  const opcoesCapa: { path: string; src: string }[] = [];
  const seenPaths = new Set<string>();
  meusPosts.forEach((post) => {
    post.fotos.forEach((f) => {
      // f.src já é a public URL. precisamos do path original também.
      // Como o feed armazena apenas src, vamos extrair o path da URL.
      // URL pattern: .../storage/v1/object/public/fotos-publicas/{path}
      const match = f.src.match(/\/fotos-publicas\/(.+?)(?:\?|$)/);
      const path = match?.[1];
      if (path && !seenPaths.has(path)) {
        seenPaths.add(path);
        opcoesCapa.push({ path, src: f.src });
      }
    });
  });

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center px-5 pt-10 pb-5 text-center">
        <CapaEditavel
          capaUrl={capa}
          nome={p.nome_exibicao ?? "Você"}
          opcoes={opcoesCapa}
          capaAtualPath={p.foto_capa_path}
        />

        <div className="flex gap-1.5 mt-4">
          {p.verificado && (
            <span
              className="flex items-center gap-1"
              style={{
                background: "rgba(0,0,0,0.5)",
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
              <ShieldIcon size={10} />
              Verificado
            </span>
          )}
          {isVip && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              ★ VIP
            </span>
          )}
        </div>

        <h1
          className="display mt-3"
          style={{
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-0)",
          }}
        >
          {p.nome_exibicao ?? "Seu perfil"}
        </h1>
        <div
          style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}
        >
          {[
            p.idade_1
              ? `${p.idade_1}${p.idade_2 ? ` · ${p.idade_2}` : ""}`
              : null,
            p.cidade,
            p.estado,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div
          className="p-4 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.15), rgba(212,175,110,0.02))",
            border: "1px solid var(--line-strong)",
          }}
        >
          <div className="flex justify-between items-center mb-2.5">
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--gold-300)",
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Nível de confiança
            </div>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--gold-300)",
              }}
            >
              {p.trust_score}%
            </div>
          </div>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 6, background: "rgba(255,255,255,0.06)" }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, p.trust_score))}%`,
                height: "100%",
                background: "var(--shine-gold)",
                boxShadow: "0 0 12px rgba(212,175,110,0.5)",
              }}
            />
          </div>
          <div
            className="flex justify-between mt-2.5"
            style={{ fontSize: 10, color: "var(--text-2)" }}
          >
            <span>{p.verificado ? "✓" : "○"} Selfie verificada</span>
            <span>✓ Perfil completo</span>
            <span>{isVip ? "★" : "○"} VIP</span>
          </div>
        </div>
      </div>

      {!isVip && (
        <div className="px-5 pt-4">
          <Link
            href="/app/vip"
            style={{
              display: "block",
              borderRadius: 18,
              textDecoration: "none",
            }}
          >
            <div
              className="flex items-center gap-3.5 p-4 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,175,110,0.16), rgba(212,175,110,0.02))",
                border: "1px solid var(--gold-500)",
                textAlign: "left",
                boxShadow: "0 0 24px rgba(212,175,110,0.12)",
              }}
            >
              <Image
                src="/logo-icon.png"
                alt=""
                width={52}
                height={52}
                style={{ objectFit: "contain", flexShrink: 0 }}
              />
              <div className="flex-1">
                <div
                  className="display gold-text"
                  style={{ fontSize: 18, fontWeight: 600 }}
                >
                  Vire VIP — R$ 9,90/mês
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-2)",
                    marginTop: 2,
                    lineHeight: 1.5,
                  }}
                >
                  Veja quem te curtiu, boost no descobrir e mais. 7 dias grátis.
                </div>
              </div>
              <span style={{ color: "var(--gold-300)", fontSize: 18 }}>→</span>
            </div>
          </Link>
        </div>
      )}

      <div className="px-5 pt-4">
        <MeuTokenCard
          token={makeViewerToken(p.id)}
          nome={p.nome_exibicao ?? "Membro"}
        />
      </div>

      <div className="px-5 pt-5 grid grid-cols-3 gap-2.5">
        <StatLink n={curtidasCount} label="enviadas" href="/app/perfil/curtidas" />
        <StatLink n={matchesCount} label="matches" href="/app/perfil/curtidas" />
        <Stat n={meusPosts.length} label="posts" />
      </div>

      <div className="px-5 pt-6">
        <div className="flex items-baseline justify-between mb-2">
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-2)",
              fontWeight: 700,
            }}
          >
            Meus posts
          </div>
          {p.verificado && (
            <Link
              href="/app/post/novo"
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--gold-300)",
                textDecoration: "none",
              }}
            >
              + Novo
            </Link>
          )}
        </div>
        <PostsTab
          posts={meusPosts}
          autorNome={p.nome_exibicao ?? "Você"}
          mode="self"
          meuToken={makeViewerToken(p.id)}
          autoOpenPostId={autoOpenPostId}
        />
      </div>

      <div className="px-5 pt-5">
        <MenuLink
          href="/app/perfil/editar"
          icon={<PencilIcon />}
          label="Editar perfil"
          hint="nome, bio, intenções"
        />
        <MenuLink
          href="/app/perfil/curtidas"
          icon={<HeartIcon />}
          label="Meus matches"
          hint={`${curtidasCount} enviados${matchesCount > 0 ? ` · ${matchesCount} mútuo${matchesCount > 1 ? "s" : ""}` : ""}`}
        />
        <MenuLink
          href="/app/perfil/fotos-privadas"
          icon={<LockIcon />}
          label="Fotos privadas"
          hint={`${fotosPriv.length} ativas`}
        />
        <MenuLink
          href="/app/perfil/pedidos"
          icon={<KeyIcon />}
          label="Pedidos de privado"
          hint={
            pedidosPendentesCount > 0
              ? `${pedidosPendentesCount} aguardando`
              : "ver e gerenciar"
          }
          badge={pedidosPendentesCount > 0 ? pedidosPendentesCount : undefined}
        />
        <MenuLink
          href="/app/perfil/stories"
          icon={<SparkleIcon />}
          label="Meus stories"
          hint="ativos · 24h"
        />
        <MenuLink
          href="/app/perfil/convites"
          icon={<TicketIcon />}
          label="Convites"
          hint="indique amigos · 5/mês"
        />
        <MenuLink
          href="/app/perfil/visitas"
          icon={<EyeIcon />}
          label="Quem visitou"
          hint={
            isVip
              ? `${visitasCount} ${visitasCount === 1 ? "visita" : "visitas"} · 30d`
              : visitasCount > 0
                ? `${visitasCount} ${visitasCount === 1 ? "visitou" : "visitaram"} · ★ VIP`
                : "★ VIP"
          }
        />
        <MenuLink
          href="/app/perfil/stats"
          icon={<StatsIcon />}
          label="Estatísticas"
          hint={isVip ? "matches, posts, visitas" : "★ VIP"}
        />
        <MenuLink
          href="/app/perfil/bloqueados"
          icon={<BlockIcon />}
          label="Bloqueados"
          hint="ver e desbloquear"
        />
        <MenuLink
          href="/app/perfil/ajustes"
          icon={<ShieldIcon size={18} />}
          label="Ajustes"
          hint="notificações, senha, email"
        />
        <DeleteAccountButton />
      </div>

      <div className="px-5 pt-6">
        <form action={signOut}>
          <button type="submit" className="btn-ghost w-full">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div
      className="text-center rounded-2xl"
      style={{
        padding: 12,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 20, fontWeight: 700, color: "var(--gold-300)" }}
      >
        {n}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function StatLink({
  n,
  label,
  href,
}: {
  n: number;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="text-center rounded-2xl block"
      style={{
        padding: 12,
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 20, fontWeight: 700, color: "var(--gold-300)" }}
      >
        {n}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </Link>
  );
}

function MenuLink({
  href,
  icon,
  label,
  hint,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="w-full flex items-center gap-3 py-3"
      style={{
        borderBottom: "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <IconBadge>{icon}</IconBadge>
      <div className="flex-1" style={{ fontSize: 14, color: "var(--text-0)" }}>
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: badge ? "var(--gold-300)" : "var(--text-3)" }}>{hint}</div>}
      {badge && (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 999,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontSize: 10,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </span>
      )}
      <span style={{ color: "var(--text-3)", fontSize: 16 }}>›</span>
    </Link>
  );
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: "rgba(212,175,110,0.1)",
        border: "1px solid var(--line)",
        color: "var(--gold-300)",
      }}
    >
      {children}
    </div>
  );
}

function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3l4 4-12 12H5v-4z" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5-10 10" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="12" rx="2" />
      <path d="M7 10V7a5 5 0 0110 0v3" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="M12 11l8-8M18 6l2 2M15 9l2 2" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
    </svg>
  );
}
function BlockIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z" />
      <path d="M9 5v14" strokeDasharray="2 2" />
    </svg>
  );
}
function StatsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
