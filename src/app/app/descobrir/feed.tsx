"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  likeProfile,
  loadFeedProfileSuggestions,
  loadMorePosts,
  togglePostLike,
  type FeedProfileSuggestion,
} from "./actions";
import {
  apagarPostAdmin,
  desfixarPostAdmin,
  fixarPostAdmin,
} from "@/lib/admin/actions";
import { PostComentariosDrawer } from "../post/post-comentarios-drawer";
import { PostLikesDrawer } from "../post/post-likes-drawer";
import { WatermarkOverlay } from "@/components/watermarked-photo";
import { FeedImage } from "@/components/feed-image";

const REFRESH_THROTTLE_MS = 30_000;
const PULL_THRESHOLD = 70;
const PULL_MAX = 140;
const PULL_RESISTANCE = 2.2;

/* ====================================================================
 * DiscoverFeed — feed vertical de posts (estilo Instagram).
 *
 *  - Cada post tem header (autor) + carrossel de fotos + caption
 *  - Action bar: ♥ post | 💬 comentar | ✕ passar | ★ curtir perfil (match)
 *  - Like no post é social (não gera match)
 *  - Curtir perfil dispara likeProfile (gera match se mútuo)
 *  - Passar oculta o post local + registra eventos_app("feed_pass")
 *  - Match overlay quando há reciprocidade
 * ================================================================== */

export type FeedPost = {
  id: string;
  texto: string;
  createdAt: string;
  likes: number;
  comentarios: number;
  curtiPorMim: boolean;
  jaCurtiPerfil: boolean;
  /** true se o post é do próprio user logado (esconde botões de
   *  curtir perfil e passar, mostra badge "Seu post"). */
  isMyPost: boolean;
  /** Timestamp ISO de quando o admin fixou esse post no topo, ou null. */
  pinnedEm: string | null;
  fotos: { id: string; src: string }[];
  autor: {
    id: string;
    nome: string;
    handle: string | null;
    cidade: string;
    tipo: "casal" | "homem" | "mulher" | null;
    verificado: boolean;
    vip: boolean;
    capa: string | null;
    checkin: { id: string; titulo: string } | null;
  };
};

export function DiscoverFeed({
  posts,
  isAdmin = false,
  meuToken,
  tipoFiltro,
}: {
  posts: FeedPost[];
  isAdmin?: boolean;
  /** Token do user logado (TC-XXXXXX) pra watermark de rastreamento */
  meuToken: string;
  /** Filtro de tipo aplicado (casal/homem/mulher), pra propagar no
   *  scroll infinito. Undefined = "Todos". */
  tipoFiltro?: string;
}) {
  const router = useRouter();
  const [list, setList] = useState(posts);
  const [match, setMatch] = useState<FeedPost["autor"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comentando, setComentando] = useState<FeedPost | null>(null);
  const [verCurtidas, setVerCurtidas] = useState<FeedPost | null>(null);
  const [, startTransition] = useTransition();

  // ── Scroll infinito ────────────────────────────────────────────────
  // 3 fases:
  //  "posts"     → ainda carregando posts via loadMorePosts (cursor=createdAt)
  //  "profiles"  → posts acabaram, mostrando sugestões de perfis ativos
  //  "done"      → ambos acabaram, mostra "✦ Você chegou ao fim ✦"
  const [phase, setPhase] = useState<"posts" | "profiles" | "done">(
    posts.length >= 15 ? "posts" : "profiles",
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState<
    FeedProfileSuggestion[]
  >([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef(list);
  const suggestionsRef = useRef(profileSuggestions);
  useEffect(() => {
    listRef.current = list;
  }, [list]);
  useEffect(() => {
    suggestionsRef.current = profileSuggestions;
  }, [profileSuggestions]);

  function handleApagarAdmin(postId: string) {
    if (!isAdmin) return;
    if (!confirm("Apagar este post?\n\nVai sumir do feed e do perfil. Não tem como desfazer.")) return;
    // Otimista: tira da lista local
    setList((atual) => atual.filter((p) => p.id !== postId));
    startTransition(async () => {
      const r = await apagarPostAdmin(postId);
      if ("error" in r) {
        setError(r.error);
        // Recarrega pra restaurar a ordem caso tenha falhado
        router.refresh();
      }
    });
  }

  function handleFixarAdmin(postId: string, jaFixado: boolean) {
    if (!isAdmin) return;
    if (jaFixado) {
      if (!confirm("Tirar esse post do topo do feed?")) return;
    }
    setError(null);
    startTransition(async () => {
      const r = jaFixado
        ? await desfixarPostAdmin(postId)
        : await fixarPostAdmin(postId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }
  const lastRefreshRef = useRef<number>(Date.now());
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    setList(posts);
    setProfileSuggestions([]);
    setPhase(posts.length >= 15 ? "posts" : "profiles");
    lastRefreshRef.current = Date.now();
    setRefreshing(false);
    setPullDistance(0);
  }, [posts]);

  // IntersectionObserver no sentinel do rodapé. Dependendo da fase,
  // carrega posts antigos OU perfis pra descobrir.
  useEffect(() => {
    if (phase === "done" || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMore) return;

        if (phase === "posts") {
          const atual = listRef.current;
          const ultimo = atual[atual.length - 1];
          if (!ultimo) {
            setPhase("profiles");
            return;
          }
          const cursor = ultimo.createdAt;
          setLoadingMore(true);
          setError(null);
          void loadMorePosts(cursor, tipoFiltro).then((r) => {
            if ("error" in r) {
              setError(r.error);
              setLoadingMore(false);
              return;
            }
            if (r.posts.length === 0) {
              // Acabaram os posts → transiciona pra sugestões de perfis
              setPhase("profiles");
              setLoadingMore(false);
              return;
            }
            setList((prev) => {
              const ids = new Set(prev.map((p) => p.id));
              const novos = r.posts.filter((p) => !ids.has(p.id));
              return [...prev, ...novos];
            });
            if (!r.hasMore) setPhase("profiles");
            setLoadingMore(false);
          });
        } else if (phase === "profiles") {
          // Exclui ids: autores dos posts no feed + perfis já sugeridos
          const postAuthorIds = listRef.current.map((p) => p.autor.id);
          const suggestedIds = suggestionsRef.current.map((p) => p.id);
          const excludeIds = Array.from(
            new Set([...postAuthorIds, ...suggestedIds]),
          );
          const cursor =
            suggestionsRef.current[suggestionsRef.current.length - 1]?.ultimoAtivo ??
            undefined;
          setLoadingMore(true);
          setError(null);
          void loadFeedProfileSuggestions(excludeIds, cursor ?? undefined).then(
            (r) => {
              if ("error" in r) {
                setError(r.error);
                setLoadingMore(false);
                return;
              }
              if (r.profiles.length === 0) {
                setPhase("done");
                setLoadingMore(false);
                return;
              }
              setProfileSuggestions((prev) => {
                const ids = new Set(prev.map((p) => p.id));
                const novos = r.profiles.filter((p) => !ids.has(p.id));
                return [...prev, ...novos];
              });
              if (!r.hasMore) setPhase("done");
              setLoadingMore(false);
            },
          );
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase, loadingMore, tipoFiltro]);

  function onCurtirSugestao(p: FeedProfileSuggestion) {
    if (p.jaCurti) return;
    setProfileSuggestions((prev) =>
      prev.map((s) => (s.id === p.id ? { ...s, jaCurti: true } : s)),
    );
    void likeProfile(p.id, "like").then((r) => {
      if ("error" in r) {
        setError(r.error);
        setProfileSuggestions((prev) =>
          prev.map((s) => (s.id === p.id ? { ...s, jaCurti: false } : s)),
        );
        return;
      }
      if ("matched" in r && r.matched) {
        setMatch({
          id: p.id,
          nome: p.nome,
          handle: p.handle,
          cidade: p.cidade,
          tipo: p.tipo,
          verificado: true,
          vip: p.vip,
          capa: p.capa,
          checkin: null,
        });
      }
    });
  }

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  // Auto-refresh: quando o user volta pra aba (depois de mais de 30s),
  // dispara router.refresh() pra puxar posts novos. Throttle pra não
  // spammar quando o user fica alternando aba rapidamente.
  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastRefreshRef.current;
      if (elapsed < REFRESH_THROTTLE_MS) return;
      lastRefreshRef.current = Date.now();
      router.refresh();
    }
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [router]);

  // Pull-to-refresh: só ativa em PWA standalone (no browser deixa o
  // gesto nativo). Acompanha touch no topo, mostra indicador dourado
  // descendo, e dispara router.refresh() ao soltar acima do threshold.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(display-mode: standalone)").matches) return;

    let startY = 0;
    let active = false;
    let isRefreshing = false;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0 || isRefreshing) return;
      startY = e.touches[0]?.clientY ?? 0;
      active = true;
    }
    function onTouchMove(e: TouchEvent) {
      if (!active || isRefreshing) return;
      const cur = e.touches[0]?.clientY ?? startY;
      const dy = cur - startY;
      if (dy > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(PULL_MAX, dy / PULL_RESISTANCE));
      } else if (dy <= 0) {
        setPullDistance(0);
      }
    }
    function onTouchEnd() {
      if (!active) return;
      active = false;
      if (pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshing) {
        isRefreshing = true;
        setRefreshing(true);
        setPullDistance(56);
        lastRefreshRef.current = Date.now();
        router.refresh();
        // Fallback: se router.refresh demorar, reseta após 1.5s.
        // O useEffect de [posts] também reseta quando os novos posts chegam.
        window.setTimeout(() => {
          if (!isRefreshing) return;
          isRefreshing = false;
          setRefreshing(false);
          setPullDistance(0);
        }, 1500);
      } else {
        setPullDistance(0);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  function onComentariosCount(postId: string, n: number) {
    setList((atual) =>
      atual.map((p) => (p.id === postId ? { ...p, comentarios: n } : p)),
    );
  }

  function onTogglePostLike(post: FeedPost) {
    const novo = !post.curtiPorMim;
    setList((atual) =>
      atual.map((p) =>
        p.id === post.id
          ? { ...p, curtiPorMim: novo, likes: p.likes + (novo ? 1 : -1) }
          : p,
      ),
    );
    void togglePostLike(post.id, novo).then((r) => {
      if ("error" in r) {
        setError(r.error);
        setList((atual) =>
          atual.map((p) =>
            p.id === post.id
              ? { ...p, curtiPorMim: !novo, likes: p.likes + (novo ? -1 : 1) }
              : p,
          ),
        );
      }
    });
  }

  function onCurtirPerfil(post: FeedPost) {
    if (post.jaCurtiPerfil) return;
    setList((atual) =>
      atual.map((p) =>
        p.autor.id === post.autor.id ? { ...p, jaCurtiPerfil: true } : p,
      ),
    );
    void likeProfile(post.autor.id, "like").then((r) => {
      if ("error" in r) {
        setError(r.error);
        setList((atual) =>
          atual.map((p) =>
            p.autor.id === post.autor.id ? { ...p, jaCurtiPerfil: false } : p,
          ),
        );
        return;
      }
      if ("matched" in r && r.matched) setMatch(post.autor);
    });
  }

  const showPullIndicator = pullDistance > 0 || refreshing;
  const pullProgress = Math.min(1, pullDistance / PULL_THRESHOLD);

  const pullIndicator = showPullIndicator ? (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: `translate(-50%, ${Math.max(8, pullDistance - 36)}px)`,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "var(--bg-1)",
        border: "1px solid var(--gold-500)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 25,
        pointerEvents: "none",
        transition: refreshing ? "transform 0.2s" : "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid rgba(212,175,110,0.25)",
          borderTopColor: "var(--gold-300)",
          transform: refreshing
            ? undefined
            : `rotate(${pullProgress * 360}deg)`,
          animation: refreshing ? "ptr-spin 0.8s linear infinite" : undefined,
        }}
      />
      <style jsx global>{`
        @keyframes ptr-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  ) : null;

  if (list.length === 0) {
    return (
      <>
        {pullIndicator}
        <div
          className="card flex flex-col items-center text-center gap-3 mx-5"
          style={{ padding: 36, marginTop: 16 }}
        >
          <div
            className="display gold-text"
            style={{ fontSize: 22, fontWeight: 500 }}
          >
            Sem posts no feed
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Ninguém postou recentemente. Que tal você abrir o feed publicando
            algo agora?
          </div>
          <Link
            href="/app/post/novo"
            className="btn-gold mt-2"
            style={{ textDecoration: "none" }}
          >
            Criar post
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => router.refresh()}
          >
            Atualizar
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {pullIndicator}

      {error && (
        <div
          role="alert"
          className="mx-5 mb-3 rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {list.map((p) => (
          <FeedPostCard
            key={p.id}
            post={p}
            isAdmin={isAdmin}
            meuToken={meuToken}
            onTogglePostLike={() => onTogglePostLike(p)}
            onCurtirPerfil={() => onCurtirPerfil(p)}
            onComentar={() => setComentando(p)}
            onApagarAdmin={() => handleApagarAdmin(p.id)}
            onFixarAdmin={() => handleFixarAdmin(p.id, !!p.pinnedEm)}
            onVerCurtidas={() => setVerCurtidas(p)}
          />
        ))}
      </div>

      {/* Cabeçalho "Pessoas pra conhecer" — aparece quando entra no
          modo profiles ou já tem sugestões na tela */}
      {(phase === "profiles" || profileSuggestions.length > 0) && (
        <div
          className="px-2"
          style={{ paddingTop: 24, paddingBottom: 6 }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--gold-300)",
              marginBottom: 4,
            }}
          >
            ✦ Pessoas pra conhecer
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Membros ativos. Toque pra ver o perfil ou curtir direto.
          </div>
        </div>
      )}

      {profileSuggestions.length > 0 && (
        <div
          className="px-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
            paddingTop: 10,
          }}
        >
          {profileSuggestions.map((p) => (
            <SuggestionCard
              key={p.id}
              p={p}
              onCurtir={() => onCurtirSugestao(p)}
            />
          ))}
        </div>
      )}

      {/* Sentinel pro IntersectionObserver + indicadores de estado */}
      {list.length > 0 && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center"
          style={{ padding: "24px 0 12px", minHeight: 48 }}
        >
          {loadingMore && (
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {phase === "profiles" ? "Buscando perfis…" : "Carregando mais…"}
            </div>
          )}
          {!loadingMore && phase === "done" && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              ✦ Você viu tudo por aqui ✦
            </div>
          )}
        </div>
      )}

      {match && <MatchOverlay autor={match} onClose={() => setMatch(null)} />}

      <PostComentariosDrawer
        postId={comentando?.id ?? ""}
        open={!!comentando}
        onClose={() => setComentando(null)}
        onCountChange={(n) => {
          if (comentando) onComentariosCount(comentando.id, n);
        }}
      />
      <PostLikesDrawer
        postId={verCurtidas?.id ?? ""}
        open={!!verCurtidas}
        onClose={() => setVerCurtidas(null)}
      />
    </>
  );
}

function FeedPostCard({
  post,
  isAdmin,
  meuToken,
  onTogglePostLike,
  onCurtirPerfil,
  onComentar,
  onApagarAdmin,
  onFixarAdmin,
  onVerCurtidas,
}: {
  post: FeedPost;
  isAdmin: boolean;
  meuToken: string;
  onTogglePostLike: () => void;
  onCurtirPerfil: () => void;
  onComentar: () => void;
  onApagarAdmin: () => void;
  onFixarAdmin: () => void;
  onVerCurtidas: () => void;
}) {
  const isPinned = !!post.pinnedEm;
  const [fotoIdx, setFotoIdx] = useState(0);
  const carrosselRef = useRef<HTMLDivElement | null>(null);

  function onScroll() {
    const el = carrosselRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const idx = Math.round(el.scrollLeft / w);
    if (idx !== fotoIdx) setFotoIdx(idx);
  }

  return (
    <article
      className="flex flex-col"
      style={{
        background: isPinned
          ? "linear-gradient(180deg, rgba(212,175,110,0.06), var(--bg-1))"
          : "var(--bg-1)",
        borderTop: isPinned ? "1px solid var(--gold-500)" : "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* Banner "Destaque" pra posts fixados */}
      {isPinned && (
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: "6px 16px",
            background: "rgba(212,175,110,0.1)",
            borderBottom: "1px solid var(--line)",
            color: "var(--gold-300)",
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          📌 Destaque do Admin
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2.5"
        style={{ padding: "10px 16px" }}
      >
        <Link
          href={`/app/p/${post.autor.id}`}
          className="relative flex-shrink-0 overflow-hidden"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid var(--gold-600)",
            background: "var(--bg-2)",
            textDecoration: "none",
          }}
          aria-label={`Perfil de ${post.autor.nome}`}
        >
          {post.autor.capa ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.autor.capa}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 14 }}
            >
              ♥
            </div>
          )}
        </Link>
        <div className="flex flex-col flex-1 min-w-0">
          <Link
            href={`/app/p/${post.autor.id}`}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-0)",
              textDecoration: "none",
            }}
          >
            {post.autor.nome}
            {post.autor.vip && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--gold-300)" }}>
                ★
              </span>
            )}
            {post.isMyPost && (
              <span
                className="mono"
                style={{
                  marginLeft: 8,
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "var(--gold-300)",
                  border: "1px solid var(--gold-600)",
                  padding: "1px 6px",
                  borderRadius: 999,
                  fontWeight: 700,
                }}
              >
                Você
              </span>
            )}
          </Link>
          <div
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: "var(--text-3)" }}
          >
            <span>{post.autor.cidade || "Brasil"}</span>
            <span>·</span>
            <span>{relativeTime(post.createdAt)}</span>
            {post.autor.checkin && (
              <>
                <span>·</span>
                <Link
                  href={`/app/eventos/${post.autor.checkin.id}`}
                  className="mono"
                  style={{
                    color: "var(--gold-300)",
                    textDecoration: "none",
                    fontSize: 10,
                    letterSpacing: 0.3,
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  📍 {post.autor.checkin.titulo}
                </Link>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onFixarAdmin}
            aria-label={isPinned ? "Desfixar post" : "Fixar no topo"}
            title={isPinned ? "Tirar do topo do feed" : "Fixar no topo do feed"}
            className="mono"
            style={{
              flexShrink: 0,
              background: isPinned
                ? "var(--shine-gold)"
                : "rgba(212,175,110,0.08)",
              border: isPinned
                ? "none"
                : "1px solid var(--gold-600)",
              color: isPinned ? "#1a0f05" : "var(--gold-300)",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
              marginRight: 4,
            }}
          >
            📌 {isPinned ? "Fixado" : "Fixar"}
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={onApagarAdmin}
            aria-label="Apagar post (admin)"
            title="Apagar post (admin)"
            className="mono"
            style={{
              flexShrink: 0,
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.4)",
              color: "var(--rose-400)",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🗑 Admin
          </button>
        )}
      </div>

      {/* Carrossel de fotos */}
      {post.fotos.length > 0 && (
        <div className="relative" style={{ background: "#000" }}>
          <div
            ref={carrosselRef}
            onScroll={onScroll}
            className="flex w-full overflow-x-auto"
            style={{
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              aspectRatio: "4/5",
            }}
          >
            {post.fotos.map((f, idx) => (
              <div
                key={f.id}
                className="flex-shrink-0 w-full relative overflow-hidden"
                style={{ scrollSnapAlign: "start" }}
              >
                {/* contain (em vez de cover) garante que foto inteira apareça
                 *  — resolve corte de cabeça em fotos verticais (9:16) que
                 *  não encaixam no aspect ratio 4:5 do container. */}
                <FeedImage
                  src={f.src}
                  alt=""
                  fit="contain"
                  // Primeira foto do post = eager (provavelmente visível);
                  // resto = lazy pra não estourar paralelismo do browser
                  loading={idx === 0 ? "eager" : "lazy"}
                />
                {/* Watermark de rastreamento — TC-XXXXXX do user logado.
                 *  Se a foto vazar, dá pra rastrear quem espalhou. */}
                <WatermarkOverlay label={meuToken} intensity="subtle" />
              </div>
            ))}
          </div>
          {post.fotos.length > 1 && (
            <div
              className="absolute mono"
              style={{
                top: 10,
                right: 10,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                padding: "3px 9px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: 0.5,
              }}
            >
              {fotoIdx + 1} / {post.fotos.length}
            </div>
          )}
          {post.fotos.length > 1 && (
            <div
              className="absolute flex justify-center gap-1.5"
              style={{ bottom: 10, left: 0, right: 0 }}
            >
              {post.fotos.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background:
                      i === fotoIdx ? "var(--gold-300)" : "rgba(255,255,255,0.45)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div
        className="flex items-center gap-4"
        style={{ padding: "10px 16px 6px" }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePostLike}
            aria-label={post.curtiPorMim ? "Descurtir" : "Curtir"}
            style={{
              background: "transparent",
              border: "none",
              color: post.curtiPorMim ? "#ff4c6b" : "var(--text-1)",
              cursor: "pointer",
              padding: 0,
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            {post.curtiPorMim ? "♥" : "♡"}
          </button>
          {post.likes > 0 && (
            <button
              type="button"
              onClick={onVerCurtidas}
              aria-label="Ver quem curtiu"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-1)",
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {post.likes}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onComentar}
          aria-label="Comentários"
          className="flex items-center gap-1.5"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-1)",
            cursor: "pointer",
            padding: 0,
            fontSize: 22,
          }}
        >
          💬
          {post.comentarios > 0 && (
            <span style={{ fontSize: 13 }}>{post.comentarios}</span>
          )}
        </button>
        <div className="flex-1" />
        {/* Botão "Match" só aparece em posts dos outros — no próprio post
             não faz sentido curtir o próprio perfil */}
        {!post.isMyPost && (
          <button
            type="button"
            onClick={onCurtirPerfil}
            disabled={post.jaCurtiPerfil}
            aria-label={
              post.jaCurtiPerfil ? "Match enviado" : "Dar match com este perfil"
            }
            className="mono"
            style={{
              background: post.jaCurtiPerfil
                ? "rgba(212,175,110,0.15)"
                : "var(--shine-gold)",
              color: post.jaCurtiPerfil ? "var(--gold-300)" : "#1a0f05",
              border: "none",
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: post.jaCurtiPerfil ? "default" : "pointer",
              opacity: post.jaCurtiPerfil ? 0.7 : 1,
            }}
          >
            {post.jaCurtiPerfil ? "✓ Match" : "Match"}
          </button>
        )}
      </div>

      {/* Caption */}
      {post.texto && (
        <div
          style={{
            padding: "0 16px 12px",
            fontSize: 14,
            color: "var(--text-0)",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <span
            style={{ fontWeight: 600, marginRight: 8 }}
          >
            {post.autor.nome}
          </span>
          {post.texto}
        </div>
      )}
    </article>
  );
}

function MatchOverlay({
  autor,
  onClose,
}: {
  autor: FeedPost["autor"];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-8"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #3a1f0e 0%, #0a0706 70%)",
        animation: "fadeUp 0.4s ease",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 6,
          color: "var(--gold-300)",
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        — sintonia —
      </div>
      <div
        className="display shimmer"
        style={{
          fontSize: 56,
          fontWeight: 500,
          lineHeight: 1,
          marginBottom: 10,
          letterSpacing: "-0.03em",
        }}
      >
        Match!
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--text-1)",
          marginBottom: 28,
          maxWidth: 320,
        }}
      >
        Vocês e <b>{autor.nome}</b> se interessaram. Logo o chat estará liberado.
      </div>

      <div className="flex flex-col gap-2.5 w-full max-w-xs">
        <Link
          href={`/app/p/${autor.id}`}
          className="btn-gold w-full text-center"
          style={{ padding: 13, textDecoration: "none" }}
        >
          Ver perfil completo
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost w-full"
          style={{ padding: 12 }}
        >
          Continuar no feed
        </button>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/* ====================================================================
 * SuggestionCard — card compacto pra "Pessoas pra conhecer"
 * Mostra capa, nome, idade/cidade, tipo, VIP, botão curtir.
 * ================================================================== */
function SuggestionCard({
  p,
  onCurtir,
}: {
  p: FeedProfileSuggestion;
  onCurtir: () => void;
}) {
  const idades =
    p.idade1 && p.idade2 ? `${p.idade1}·${p.idade2}` : p.idade1 ? `${p.idade1}` : "";
  const tipoLabel =
    p.tipo === "casal" ? "Casal" : p.tipo === "homem" ? "Homem" : p.tipo === "mulher" ? "Mulher" : null;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: "3/4",
        borderRadius: 14,
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
      }}
    >
      <Link
        href={`/app/p/${p.id}`}
        aria-label={`Ver perfil de ${p.nome}`}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      />
      {p.capa ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={p.capa}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover" }}
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: "var(--gold-300)", fontSize: 28 }}
        >
          ♥
        </div>
      )}

      {/* badges top-right */}
      <div
        className="absolute"
        style={{
          top: 6,
          right: 6,
          display: "flex",
          gap: 4,
          flexDirection: "column",
          alignItems: "flex-end",
          zIndex: 2,
        }}
      >
        {p.vip && (
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

      {/* gradiente + info no rodapé */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
          padding: "20px 8px 8px",
          zIndex: 2,
        }}
      >
        <div
          className="truncate"
          style={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}
        >
          {p.nome}
        </div>
        <div
          className="truncate"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 10,
            marginTop: 2,
          }}
        >
          {[idades, p.cidade, tipoLabel].filter(Boolean).join(" · ") || "Brasil"}
        </div>

        {/* Botão curtir flutuando no canto inferior direito */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCurtir();
          }}
          aria-label={p.jaCurti ? "Já curtido" : "Curtir perfil"}
          disabled={p.jaCurti}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: p.jaCurti
              ? "rgba(212,175,110,0.35)"
              : "var(--shine-gold)",
            color: p.jaCurti ? "#fff" : "#1a0f05",
            border: "none",
            cursor: p.jaCurti ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            zIndex: 3,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {p.jaCurti ? "✓" : "★"}
        </button>
      </div>
    </div>
  );
}
