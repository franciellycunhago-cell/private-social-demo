"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { togglePostLike } from "../../descobrir/actions";
import { deletePost } from "../../post/novo/actions";
import { apagarPostAdmin } from "@/lib/admin/actions";
import { PostComentariosDrawer } from "../../post/post-comentarios-drawer";
import { PostLikesDrawer } from "../../post/post-likes-drawer";
import { WatermarkOverlay } from "@/components/watermarked-photo";
import { FeedImage } from "@/components/feed-image";
import type { ProfilePost } from "@/lib/posts/server";

export type { ProfilePost };

/* ====================================================================
 * PostsTab — grid 3 colunas + modal de visualização de post.
 *
 *  - mode="self": mostra botão APAGAR no modal
 *  - mode="other": mostra botão de like no post
 *  - mode="other" + isAdmin: mostra botão APAGAR (ADMIN) extra
 *  - O grid mostra a primeira foto como thumb, com badge se há +1 foto
 *  - Modal exibe carrossel completo + caption + counts
 * ================================================================== */

type Props = {
  posts: ProfilePost[];
  autorNome: string;
  mode: "self" | "other";
  isAdmin?: boolean;
  onAfterDelete?: () => void;
  /** Token TC-XXXXXX do user logado pra watermark de rastreamento */
  meuToken: string;
  /** ID do post pra abrir automaticamente no modal (deep link de
   *  notificação tipo "Tom curtiu seu post"). */
  autoOpenPostId?: string | null;
};

export function PostsTab({
  posts,
  autorNome,
  mode,
  isAdmin = false,
  onAfterDelete,
  meuToken,
  autoOpenPostId = null,
}: Props) {
  const [list, setList] = useState(posts);
  const [aberto, setAberto] = useState<ProfilePost | null>(null);

  useEffect(() => {
    setList(posts);
  }, [posts]);

  // Auto-abre o modal quando vier de uma notificação (?post=...)
  useEffect(() => {
    if (!autoOpenPostId) return;
    const target = posts.find((p) => p.id === autoOpenPostId);
    if (target) setAberto(target);
  }, [autoOpenPostId, posts]);

  function onUpdatePost(updated: ProfilePost) {
    setList((atual) => atual.map((p) => (p.id === updated.id ? updated : p)));
    setAberto(updated);
  }

  function onDelete(id: string) {
    setList((atual) => atual.filter((p) => p.id !== id));
    setAberto(null);
    onAfterDelete?.();
  }

  if (list.length === 0) {
    return (
      <div
        className="flex flex-col items-center text-center gap-2"
        style={{ padding: 32 }}
      >
        <div style={{ fontSize: 32 }}>📷</div>
        <div
          className="display"
          style={{ fontSize: 16, fontWeight: 500, color: "var(--text-1)" }}
        >
          {mode === "self" ? "Sem posts ainda" : "Ainda sem posts"}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.5,
            maxWidth: 240,
          }}
        >
          {mode === "self"
            ? "Crie seu primeiro post a partir do feed."
            : "Esse perfil ainda não publicou nada."}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAberto(p)}
            className="relative overflow-hidden"
            style={{
              aspectRatio: "1/1",
              background: "var(--bg-2)",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
            aria-label="Abrir post"
          >
            {p.fotos[0]?.src ? (
              <>
                {/* objectPosition "center top" prioriza topo da imagem —
                 *  foto vertical mantém a cabeça/rosto, corta o pé. Se
                 *  não setar, default é "center center" e corta cabeça. */}
                <FeedImage
                  src={p.fotos[0].src}
                  alt=""
                  fit="cover"
                  objectPosition="center top"
                  loading="lazy"
                />
                {/* Watermark de rastreamento — TC do user logado */}
                <WatermarkOverlay label={meuToken} intensity="subtle" />
              </>
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  color: "var(--text-3)",
                  fontSize: 11,
                  padding: 8,
                  textAlign: "center",
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                }}
              >
                {p.texto.slice(0, 60)}
              </div>
            )}
            {/* Carrossel desativado — cada foto vira post separado. Badge
                removido. Mantém esta condição apenas como salvaguarda
                pra qualquer post legado que tenha múltiplas fotos. */}
          </button>
        ))}
      </div>

      {aberto && (
        <PostViewerModal
          post={aberto}
          autorNome={autorNome}
          mode={mode}
          isAdmin={isAdmin}
          meuToken={meuToken}
          onClose={() => setAberto(null)}
          onUpdate={onUpdatePost}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function PostViewerModal({
  post,
  autorNome,
  mode,
  isAdmin,
  meuToken,
  onClose,
  onUpdate,
  onDelete,
}: {
  post: ProfilePost;
  autorNome: string;
  mode: "self" | "other";
  isAdmin: boolean;
  meuToken: string;
  onClose: () => void;
  onUpdate: (p: ProfilePost) => void;
  onDelete: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [comentariosAberto, setComentariosAberto] = useState(false);
  const [likesAberto, setLikesAberto] = useState(false);
  const carrosselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  function onScroll() {
    const el = carrosselRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const idx = Math.round(el.scrollLeft / w);
    if (idx !== fotoIdx) setFotoIdx(idx);
  }

  function onToggleLike() {
    const novo = !post.curtiPorMim;
    onUpdate({
      ...post,
      curtiPorMim: novo,
      likes: post.likes + (novo ? 1 : -1),
    });
    void togglePostLike(post.id, novo).then((r) => {
      if ("error" in r) {
        setError(r.error);
        onUpdate(post);
      }
    });
  }

  async function onApagar() {
    if (!confirm("Apagar esse post? Essa ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    const result = await deletePost(post.id);
    if ("error" in result) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    onDelete(post.id);
  }

  async function onApagarAdmin() {
    if (
      !confirm(
        "Apagar este post como ADMIN?\n\nVai sumir do feed e do perfil. Não tem como desfazer.",
      )
    )
      return;
    setDeleting(true);
    setError(null);
    const result = await apagarPostAdmin(post.id);
    if ("error" in result) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    onDelete(post.id);
  }

  const content = (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 99999, background: "rgba(0,0,0,0.85)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md flex flex-col"
        style={{
          background: "var(--bg-1)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          height: "92dvh",
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid var(--line)",
            flexShrink: 0,
          }}
        >
          <div
            className="display"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-0)" }}
          >
            {autorNome}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-2)",
              fontSize: 20,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll">
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
                    <FeedImage
                      src={f.src}
                      alt=""
                      fit="contain"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                    {/* Watermark de rastreamento — TC do user logado */}
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
                  }}
                >
                  {fotoIdx + 1} / {post.fotos.length}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: "10px 16px 6px" }}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                {mode === "other" ? (
                  <button
                    type="button"
                    onClick={onToggleLike}
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
                ) : (
                  <span
                    style={{
                      color: "var(--text-1)",
                      fontSize: 22,
                      lineHeight: 1,
                    }}
                  >
                    ♥
                  </span>
                )}
                {post.likes > 0 && (
                  <button
                    type="button"
                    onClick={() => setLikesAberto(true)}
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
                onClick={() => setComentariosAberto(true)}
                aria-label="Comentários"
                className="flex items-center gap-1.5"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-1)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 18,
                }}
              >
                💬
                {post.comentarios > 0 && (
                  <span style={{ fontSize: 13 }}>{post.comentarios}</span>
                )}
              </button>
              <div className="flex-1" />
              {mode === "self" && (
                <button
                  type="button"
                  onClick={onApagar}
                  disabled={deleting}
                  className="mono"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(217,138,114,0.4)",
                    color: "var(--rose-400)",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    cursor: deleting ? "wait" : "pointer",
                  }}
                >
                  {deleting ? "Apagando..." : "Apagar"}
                </button>
              )}
              {mode === "other" && isAdmin && (
                <button
                  type="button"
                  onClick={onApagarAdmin}
                  disabled={deleting}
                  className="mono"
                  title="Apagar post (admin)"
                  style={{
                    background: "rgba(217,138,114,0.08)",
                    border: "1px solid rgba(217,138,114,0.5)",
                    color: "var(--rose-400)",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    cursor: deleting ? "wait" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {deleting ? "Apagando..." : "🗑 Admin"}
                </button>
              )}
            </div>
          </div>

          {post.texto && (
            <div
              style={{
                padding: "0 16px 16px",
                fontSize: 14,
                color: "var(--text-0)",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {post.texto}
            </div>
          )}

          <div
            style={{
              padding: "0 16px 16px",
              fontSize: 11,
              color: "var(--text-3)",
            }}
          >
            {new Date(post.createdAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-3 rounded-xl p-3"
              style={{
                background: "rgba(217,138,114,0.08)",
                border: "1px solid rgba(217,138,114,0.3)",
                color: "var(--rose-400)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(content, document.body)}
      <PostComentariosDrawer
        postId={post.id}
        open={comentariosAberto}
        onClose={() => setComentariosAberto(false)}
        onCountChange={(n) => onUpdate({ ...post, comentarios: n })}
      />
      <PostLikesDrawer
        postId={post.id}
        open={likesAberto}
        onClose={() => setLikesAberto(false)}
      />
    </>
  );
}
