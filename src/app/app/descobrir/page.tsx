import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import {
  EVENTO_COLS,
  formatEventoData,
  type EventoRow,
} from "@/lib/eventos";
import { resolveEventoFotos } from "@/lib/eventos-server";
import { loadStoriesBarForUser, loadMyStoriesAutor } from "@/lib/stories-server";
import { loadBlockedSet } from "@/lib/moderacao/server";
import { loadActiveCheckinsForProfiles } from "@/lib/checkins/server";
import { StoriesBar } from "./stories-bar";
import { DiscoverFeed, type FeedPost } from "./feed";
import { EventoBanner, type EventoBannerItem } from "./evento-banner";
import { makeViewerToken } from "@/lib/watermark-token";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Descobrir — PrivateSocial",
};

const PAGE_SIZE = 15;

/* ====================================================================
 * /app/descobrir
 *
 * Feed estilo Instagram (substitui swipe).
 *  - Carrega posts dos outros usuários (verificados)
 *  - Cada item: header + carrossel de fotos + caption + ações
 *  - Filtros: tipo do autor (casal/mulher/homem)
 *  - Exclui posts de perfis "passados" nas últimas 48h (feed_pass)
 *  - Stories e banner de eventos no topo
 *  - FAB pra criar novo post (só verificados)
 * ================================================================== */

type SearchParams = Promise<{ tipo?: string }>;

export default async function DescobrirPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;
  const meuTipo = info.status.profile.tipo; // "casal" | "homem" | "mulher" | null

  const params = await searchParams;
  const tipoFiltro = params.tipo;

  const supabase = await createClient();
  const admin = adminClient();

  // Banner de eventos publicados (até 3 próximos) + bloqueados
  const [eventosBannerRes, blockedSet] = await Promise.all([
    supabase
      .from("eventos")
      .select(EVENTO_COLS)
      .eq("publicado", true)
      .gte("data", new Date().toISOString())
      .order("data", { ascending: true })
      .limit(3),
    loadBlockedSet(meId),
  ]);

  // Posts do feed — INCLUI os próprios posts do user (decisão UX 27/04:
  // pessoas querem se ver no feed pra acompanhar como aparece pros outros).
  // Buscamos PAGE_SIZE * 3 pra ter material pro boost de VIP. Filtramos
  // bloqueados client-side pra simplificar (admin bypassa RLS).
  const { data: postsRaw } = await admin
    .from("posts")
    .select(
      "id, profile_id, texto, likes_count, comentarios_count, created_at, pinned_em",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE * 3);

  // Admin bypassa o filtro de bloqueio — vê todos os posts no feed,
  // mesmo de quem bloqueou ele (acesso total a todos os perfis).
  const filtered = ((postsRaw ?? []) as Array<{
    id: string;
    profile_id: string;
    texto: string;
    likes_count: number;
    comentarios_count: number;
    created_at: string;
    pinned_em: string | null;
  }>)
    .filter((p) => info.isAdmin || !blockedSet.has(p.profile_id))
    .slice(0, PAGE_SIZE);

  const profileIds = Array.from(new Set(filtered.map((p) => p.profile_id)));
  const postIds = filtered.map((p) => p.id);

  let posts: FeedPost[] = [];

  if (filtered.length > 0) {
    const [
      profilesRes,
      fotosPostRes,
      meusLikesRes,
      minhasCurtidasRes,
      checkinsMap,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, handle, nome_exibicao, tipo, cidade, estado, verificado, vip_ate, suspenso, deletado_em, quem_pode_ver, foto_capa_path",
        )
        .in("id", profileIds),
      admin
        .from("posts_fotos")
        .select("id, post_id, url, ordem")
        .in("post_id", postIds)
        .order("ordem", { ascending: true }),
      admin
        .from("posts_likes")
        .select("post_id")
        .eq("profile_id", meId)
        .in("post_id", postIds),
      admin
        .from("curtidas")
        .select("para_id")
        .eq("de_id", meId)
        .in("para_id", profileIds),
      loadActiveCheckinsForProfiles(profileIds),
    ]);

    type ProfileLite = {
      id: string;
      handle: string | null;
      nome_exibicao: string | null;
      tipo: "casal" | "homem" | "mulher" | null;
      cidade: string | null;
      estado: string | null;
      verificado: boolean;
      vip_ate: string | null;
      suspenso: boolean;
      deletado_em: string | null;
      quem_pode_ver: { casal?: boolean; homem?: boolean; mulher?: boolean } | null;
      foto_capa_path: string | null;
    };

    const profilesMap = new Map<string, ProfileLite>();
    ((profilesRes.data ?? []) as ProfileLite[]).forEach((p) =>
      profilesMap.set(p.id, p),
    );

    // Filtra posts cujo autor não passou no filtro de tipo
    const filterByTipo =
      tipoFiltro === "casal" ||
      tipoFiltro === "mulher" ||
      tipoFiltro === "homem";

    // Capa de cada autor a partir do profile.foto_capa_path. Fallback:
    // primeira foto do primeiro post (resolvido depois no map).
    const capaMap = new Map<string, string>();
    profilesMap.forEach((prof, pid) => {
      if (prof.foto_capa_path) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(prof.foto_capa_path);
        if (data.publicUrl) capaMap.set(pid, data.publicUrl);
      }
    });

    const fotosByPost = new Map<string, { id: string; src: string }[]>();
    (fotosPostRes.data ?? []).forEach((f) => {
      const pid = f.post_id as string;
      const { data } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      const arr = fotosByPost.get(pid) ?? [];
      arr.push({ id: f.id as string, src: data.publicUrl });
      fotosByPost.set(pid, arr);
    });

    const likedSet = new Set<string>(
      (meusLikesRes.data ?? []).map((l) => l.post_id as string),
    );
    const curtidoPerfilSet = new Set<string>(
      (minhasCurtidasRes.data ?? []).map((c) => c.para_id as string),
    );

    // Matches do user — quem já é match passa pelo filtro "quem pode te ver"
    const { data: matchesData } = await admin
      .from("matches")
      .select("profile_1, profile_2")
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`);
    const matchedSet = new Set<string>(
      ((matchesData ?? []) as Array<{ profile_1: string; profile_2: string }>)
        .map((m) => (m.profile_1 === meId ? m.profile_2 : m.profile_1)),
    );

    posts = filtered
      .map((p): FeedPost | null => {
        const prof = profilesMap.get(p.profile_id);
        if (!prof || !prof.verificado) return null;
        // Esconde posts de perfis suspensos ou excluídos (carência ou definitivo)
        if (prof.suspenso || prof.deletado_em) return null;
        if (filterByTipo && prof.tipo !== tipoFiltro) return null;

        // Filtro "quem pode te ver" — se o autor não permite o meu tipo,
        // não aparece. Match já existente bypassa (conversa em andamento).
        // Admin bypassa o filtro inteiro — vê posts de todos os perfis.
        if (meuTipo && !info.isAdmin && !matchedSet.has(prof.id)) {
          const qpv = prof.quem_pode_ver ?? {
            casal: true,
            homem: true,
            mulher: true,
          };
          if (qpv[meuTipo] === false) return null;
        }

        return {
          id: p.id,
          texto: p.texto,
          createdAt: p.created_at,
          likes: p.likes_count,
          comentarios: p.comentarios_count,
          curtiPorMim: likedSet.has(p.id),
          jaCurtiPerfil: curtidoPerfilSet.has(p.profile_id),
          isMyPost: p.profile_id === meId,
          pinnedEm: p.pinned_em,
          fotos: fotosByPost.get(p.id) ?? [],
          autor: {
            id: prof.id,
            nome: prof.nome_exibicao ?? "Sem nome",
            handle: prof.handle,
            cidade: [prof.cidade, prof.estado].filter(Boolean).join(", "),
            tipo: prof.tipo,
            verificado: prof.verificado,
            vip: prof.vip_ate
              ? new Date(prof.vip_ate) > new Date()
              : false,
            capa: capaMap.get(prof.id) ?? null,
            checkin: checkinsMap.get(prof.id) ?? null,
          },
        };
      })
      .filter((p): p is FeedPost => p !== null);

    // Ordenação:
    // 1. Posts FIXADOS pelo admin sempre vão pro topo (ordenados pelo
    //    pinned_em desc — mais recente fixado fica primeiro)
    // 2. Resto: boost VIP (+12h no timestamp) + ordem cronológica
    //
    // Boost VIP: post VIP de 14h atrás compete com free de 2h atrás.
    const VIP_BOOST_MS = 12 * 60 * 60 * 1000;
    posts = posts
      .map((p) => ({
        post: p,
        isPinned: !!p.pinnedEm,
        rank: p.pinnedEm
          ? // Pinned: rank = timestamp do pin + offset gigante
            new Date(p.pinnedEm).getTime() + 1e15
          : new Date(p.createdAt).getTime() +
            (p.autor.vip ? VIP_BOOST_MS : 0),
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, PAGE_SIZE)
      .map((x) => x.post);
  }

  const eventosBannerRaw = (eventosBannerRes.data ?? []) as EventoRow[];
  const eventosBanner = [...eventosBannerRaw].sort((a, b) => {
    if (a.destacado === b.destacado) return 0;
    return a.destacado ? -1 : 1;
  });
  const eventosBannerFotos = await resolveEventoFotos(eventosBanner);
  const bannerItems: EventoBannerItem[] = eventosBanner.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    dataFmt: formatEventoData(e.data),
    cidade: e.cidade,
    capa: eventosBannerFotos.get(e.id) ?? null,
    vipOnly: e.vip_only,
  }));

  const [storiesBarRaw, meuStoriesAutor] = await Promise.all([
    loadStoriesBarForUser(meId),
    loadMyStoriesAutor(meId),
  ]);
  // Admin vê stories de todo mundo, mesmo de quem o bloqueou.
  const storiesBar = storiesBarRaw.filter(
    (a) => info.isAdmin || !blockedSet.has(a.profileId),
  );
  const autoresBar = meuStoriesAutor
    ? [meuStoriesAutor, ...storiesBar]
    : storiesBar;

  return (
    <div className="relative flex flex-col" style={{ minHeight: "100dvh" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(212,175,110,0.22), transparent 60%)",
        }}
      />

      <div
        className="relative z-10 flex items-center justify-center px-5"
        style={{ paddingTop: 22, paddingBottom: 4 }}
      >
        <Image
          src="/logo.png"
          alt="PrivateSocial"
          width={1584}
          height={672}
          priority
          sizes="(max-width: 448px) 65vw, 240px"
          style={{
            width: "100%",
            maxWidth: 240,
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 16px rgba(212,175,110,0.4))",
          }}
        />
      </div>

      <header
        className="relative z-10 flex items-center justify-between px-5"
        style={{ paddingTop: 6, paddingBottom: 10 }}
      >
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--text-1)",
          }}
        >
          <span style={{ color: "var(--gold-400)" }}>●</span>
          {info.status.profile.cidade ?? "Brasil"}
        </div>
        <Link
          href="/app/buscar"
          aria-label="Buscar usuários"
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--text-1)",
            textDecoration: "none",
          }}
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--gold-300)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Buscar
        </Link>
      </header>

      {bannerItems.length > 0 && <EventoBanner items={bannerItems} />}

      <div className="relative z-10 px-5">
        <StoriesBar autores={autoresBar} compact meId={meId} />
      </div>

      <div className="relative z-10 flex gap-2 px-5 pt-4 pb-3 overflow-x-auto scroll">
        <FilterChip label="Todos" active={!tipoFiltro} href="/app/descobrir" />
        <FilterChip
          label="Casais"
          active={tipoFiltro === "casal"}
          href="/app/descobrir?tipo=casal"
        />
        <FilterChip
          label="Mulheres"
          active={tipoFiltro === "mulher"}
          href="/app/descobrir?tipo=mulher"
        />
        <FilterChip
          label="Homens"
          active={tipoFiltro === "homem"}
          href="/app/descobrir?tipo=homem"
        />
      </div>

      <div className="relative z-10 flex-1 pb-8">
        <DiscoverFeed
          posts={posts}
          isAdmin={info.isAdmin}
          meuToken={makeViewerToken(meId)}
          tipoFiltro={tipoFiltro}
        />
      </div>
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
