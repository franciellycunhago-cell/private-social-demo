"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FotoComSrc } from "@/lib/supabase/fotos";
import { compatLabel } from "@/lib/compatibilidade";
import {
  likeFromProfile,
  requestPrivateAccess,
  openChatWith,
  togglePhotoLike,
} from "./actions";
import { ComentariosDrawer } from "./comentarios-drawer";
import { PhotoLikesDrawer } from "./photo-likes-drawer";
import { PostsTab, type ProfilePost } from "./posts-tab";
import { ProfileMoreMenu } from "./profile-more-menu";
import { WatermarkedPhoto, WatermarkOverlay } from "@/components/watermarked-photo";
import { FeedImage } from "@/components/feed-image";
import { PrivateWarningModal } from "@/components/private-warning-modal";

/* ====================================================================
 * ProfileView — detalhe de outro perfil com 4 tabs.
 *
 *  - Sobre: bio + intenções + limites + verificações
 *  - Fotos: grid de públicas
 *  - Posts: feed de posts do perfil
 *  - Privado: CTA "Solicitar acesso" + grid blurred
 *
 * Recebe props já resolvidas do server (fotos com signed URLs quando
 * aplicável, flag de pedido já existente, curtida já existente).
 * ================================================================== */

type PerfilDetail = {
  id: string;
  nome: string;
  idades: string;
  cidade: string;
  tipo: "casal" | "homem" | "mulher" | null;
  experiencia: string | null;
  trust_score: number;
  verificado: boolean;
  vip: boolean;
  bio: string | null;
  intencoes: string[];
  limites: string[];
  capa: string | null;
  checkin: { id: string; titulo: string } | null;
};

type Props = {
  perfil: PerfilDetail;
  publicas: FotoComSrc[];
  privadas: FotoComSrc[];
  totalPrivadas: number;
  posts: ProfilePost[];
  pedidoStatus: "pendente" | "aprovado" | "negado" | null;
  jaCurtiu: boolean;
  jaBloqueado: boolean;
  compatScore: number;
  isAdmin: boolean;
  chatAberto: boolean;
  meuToken: string;
};

export function ProfileView({
  perfil,
  publicas,
  privadas,
  totalPrivadas,
  posts,
  pedidoStatus,
  jaCurtiu,
  jaBloqueado,
  compatScore,
  isAdmin,
  chatAberto,
  meuToken,
}: Props) {
  // Admin tem chip extra no bottom nav — CTA precisa subir mais.
  const ctaBottom = isAdmin ? 132 : 92;
  // Botão "Conversar" aparece pra admin sempre + pra todo mundo quando
  // chat_aberto está ligado (modo early stage pra forçar interação).
  const podeConversar = isAdmin || chatAberto;
  const containerPadBottom = ctaBottom + 60;
  const router = useRouter();
  const [tab, setTab] = useState<"sobre" | "posts" | "privado">("sobre");
  const [pedido, setPedido] = useState(pedidoStatus);
  const [curtiu, setCurtiu] = useState(jaCurtiu);
  const [matchOverlay, setMatchOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [comentandoFoto, setComentandoFoto] = useState<FotoComSrc | null>(null);
  const [comentandoFotoPrivada, setComentandoFotoPrivada] = useState(false);

  // Estado local de curtidas das fotos (público + privado): map fotoId →
  // { curtido, total }. Inicializado a partir das props pra ter resposta
  // otimista no toggle.
  const [fotoLikes, setFotoLikes] = useState<
    Record<string, { curtido: boolean; total: number }>
  >(() => {
    const init: Record<string, { curtido: boolean; total: number }> = {};
    [...publicas, ...privadas].forEach((f) => {
      init[f.id] = {
        curtido: !!f.curtidoPorMim,
        total: f.likes_count ?? 0,
      };
    });
    return init;
  });
  const [likersOpen, setLikersOpen] = useState<string | null>(null);

  function onTogglePhotoLike(fotoId: string) {
    const atual = fotoLikes[fotoId] ?? { curtido: false, total: 0 };
    const novoCurtido = !atual.curtido;
    // Otimista
    setFotoLikes((prev) => ({
      ...prev,
      [fotoId]: {
        curtido: novoCurtido,
        total: Math.max(0, atual.total + (novoCurtido ? 1 : -1)),
      },
    }));
    void togglePhotoLike(fotoId).then((r) => {
      if ("error" in r) {
        // Reverte em caso de erro
        setFotoLikes((prev) => ({ ...prev, [fotoId]: atual }));
        setError(r.error);
      } else {
        setFotoLikes((prev) => ({
          ...prev,
          [fotoId]: { curtido: r.curtido, total: r.total },
        }));
      }
    });
  }

  function abrirComentarios(f: FotoComSrc, privada: boolean) {
    setComentandoFotoPrivada(privada);
    setComentandoFoto(f);
  }

  function onRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestPrivateAccess(perfil.id);
      if ("error" in result) setError(result.error);
      else setPedido("pendente");
    });
  }

  function onLike() {
    setError(null);
    startTransition(async () => {
      const result = await likeFromProfile(perfil.id);
      if ("error" in result) {
        setError(result.error);
      } else {
        setCurtiu(true);
        if (result.matched) setMatchOverlay(true);
      }
    });
  }

  function onConversar() {
    setError(null);
    startTransition(async () => {
      const result = await openChatWith(perfil.id);
      if ("error" in result) setError(result.error);
      else router.push(`/app/conversas/${result.matchId}`);
    });
  }

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden"
        style={{ height: 560, background: "var(--bg-1)" }}
      >
        {perfil.capa ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={perfil.capa}
              alt=""
              aria-hidden
              className="no-save absolute inset-0 w-full h-full"
              style={{
                objectFit: "cover",
                filter: "blur(30px) brightness(0.55)",
                transform: "scale(1.2)",
                userSelect: "none",
                WebkitTouchCallout: "none",
                pointerEvents: "none",
              }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={perfil.capa}
              alt={perfil.nome}
              className="no-save absolute inset-0 w-full h-full"
              style={{
                objectFit: "contain",
                userSelect: "none",
                WebkitTouchCallout: "none",
              }}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 35% 35%, rgba(212,175,110,0.25), transparent 55%), linear-gradient(145deg, #2a1810 0%, #0a0706 70%)",
            }}
          />
        )}
        {/* Watermark de rastreamento na capa — TC do user logado.
         *  Fica abaixo do gradiente de info pra não atrapalhar leitura. */}
        {perfil.capa && <WatermarkOverlay label={meuToken} intensity="subtle" />}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 50%, rgba(8,4,2,1) 100%)",
          }}
        />

        <Link
          href="/app/descobrir"
          aria-label="Voltar"
          className="absolute top-14 left-4 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          ‹
        </Link>

        <div className="absolute top-14 right-4">
          <ProfileMoreMenu
            targetId={perfil.id}
            targetNome={perfil.nome}
            jaBloqueado={jaBloqueado}
          />
        </div>

        <div className="absolute top-20 right-4 flex flex-col gap-1.5 items-end">
          {perfil.vip && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                padding: "5px 11px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              ★ VIP
            </span>
          )}
        </div>

        <div className="absolute left-5 right-5 bottom-5 text-white">
          {perfil.verificado && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--gold-500)",
                color: "var(--gold-300)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              ✓ Verificado · confiança {perfil.trust_score}%
            </span>
          )}
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <div
              className="display"
              style={{
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              {perfil.nome}
            </div>
            {perfil.idades && (
              <div style={{ fontSize: 17, color: "rgba(255,255,255,0.75)" }}>
                {perfil.idades}
              </div>
            )}
          </div>
          {perfil.checkin && (
            <Link
              href={`/app/eventos/${perfil.checkin.id}`}
              className="mono inline-flex items-center gap-1 mt-2"
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: 0.3,
                fontWeight: 700,
                textDecoration: "none",
                maxWidth: "85%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                boxShadow: "0 6px 18px rgba(212,175,110,0.4)",
                width: "fit-content",
              }}
            >
              📍 Está em: {perfil.checkin.titulo}
            </Link>
          )}
          <div
            className="flex gap-2 items-center mt-1"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}
          >
            <span>{perfil.cidade || "Brasil"}</span>
            {perfil.tipo && (
              <>
                <span>·</span>
                <span>{tipoLabel(perfil.tipo)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pt-5" style={{ paddingBottom: containerPadBottom }}>
        <div className="flex gap-1.5 mb-4 overflow-x-auto scroll" style={{ scrollbarWidth: "none" }}>
          <TabBtn active={tab === "sobre"} onClick={() => setTab("sobre")}>
            Sobre
          </TabBtn>
          <TabBtn active={tab === "posts"} onClick={() => setTab("posts")}>
            Posts · {posts.length}
          </TabBtn>
          <TabBtn active={tab === "privado"} onClick={() => setTab("privado")}>
            Privado · {totalPrivadas}
          </TabBtn>
        </div>

        {tab === "sobre" && (
          <>
            <CompatCard score={compatScore} />
            {perfil.bio && (
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-1)",
                  lineHeight: 1.6,
                  marginBottom: 22,
                }}
              >
                {perfil.bio}
              </div>
            )}

            {perfil.intencoes.length > 0 && (
              <Section title="Intenções">
                <div className="flex flex-wrap gap-1.5">
                  {perfil.intencoes.map((i) => (
                    <span
                      key={i}
                      className="chip gold"
                      style={{ fontSize: 11 }}
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {perfil.limites.length > 0 && (
              <Section title="Aceita / prefere">
                <div className="flex flex-wrap gap-1.5">
                  {perfil.limites.map((t) => (
                    <span key={t} className="chip" style={{ fontSize: 11 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Verificações">
              <VerRow ok={true} label="Email confirmado" />
              <VerRow ok={perfil.verificado} label="Selfie verificada" />
              <VerRow ok={perfil.vip} label="Membro VIP" last />
            </Section>
          </>
        )}

        {tab === "posts" && (
          <PostsTab
            posts={posts}
            autorNome={perfil.nome}
            mode="other"
            isAdmin={isAdmin}
            meuToken={meuToken}
          />
        )}

        {tab === "privado" && (
          <PrivateTab
            perfilNome={perfil.nome}
            totalPrivadas={totalPrivadas}
            pedidoStatus={pedido}
            liberadas={privadas}
            onRequest={onRequest}
            onComentar={(f) => abrirComentarios(f, true)}
            onToggleLike={onTogglePhotoLike}
            onAbrirLikers={(id) => setLikersOpen(id)}
            fotoLikes={fotoLikes}
            pending={pending}
            meuToken={meuToken}
          />
        )}

        <PrivateWarningModal
          armed={tab === "privado" && pedido === "aprovado"}
          onDeny={() => setTab("sobre")}
        />

        {error && (
          <div
            className="mt-4 rounded-xl p-3"
            style={{
              background: "rgba(217, 138, 114, 0.08)",
              border: "1px solid rgba(217, 138, 114, 0.3)",
              color: "var(--rose-400)",
              fontSize: 13,
            }}
            role="alert"
          >
            {error}
          </div>
        )}
      </div>

      <div
        className="fixed left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-5 flex gap-2.5"
        style={{ bottom: ctaBottom }}
      >
        <button
          type="button"
          onClick={onLike}
          disabled={pending || curtiu}
          className={curtiu ? "btn-ghost" : "btn-gold"}
          style={{
            flex: 1,
            padding: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pending ? 0.7 : 1,
          }}
        >
          {curtiu ? (
            <>✓ Match enviado</>
          ) : (
            <>
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="#1a0f05"
                stroke="#1a0f05"
                strokeWidth={1.6}
              >
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />
              </svg>
              Match
            </>
          )}
        </button>

        {podeConversar && (
          <button
            type="button"
            onClick={onConversar}
            disabled={pending}
            className="btn-gold"
            style={{
              flex: 1,
              padding: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pending ? 0.7 : 1,
            }}
          >
            <svg
              width={17}
              height={17}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a0f05"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H9l-4 4v-4H5.5C4.67 16 4 15.33 4 14.5v-9z" />
              <path d="M8.5 9.5h7" strokeLinecap="round" />
              <path d="M8.5 12h4.5" strokeLinecap="round" />
            </svg>
            Conversar
          </button>
        )}
      </div>

      <ComentariosDrawer
        fotoId={comentandoFoto?.id ?? ""}
        fotoPreview={comentandoFoto?.src ?? null}
        open={!!comentandoFoto}
        onClose={() => setComentandoFoto(null)}
        // Aplica watermark em TODAS as fotos no modal grande (públicas
        // e privadas). Antes só ia em privada — mas a versão pequena no
        // grid já tinha `WatermarkOverlay`, então ao abrir grande o token
        // sumia. Agora consistente: pequena e grande sempre com TC do user.
        watermarkLabel={meuToken}
      />

      <PhotoLikesDrawer
        fotoId={likersOpen ?? ""}
        open={!!likersOpen}
        onClose={() => setLikersOpen(null)}
      />

      {matchOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-8"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #3a1f0e 0%, #0a0706 70%)",
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
          <div style={{ fontSize: 14, color: "var(--text-1)", marginBottom: 24 }}>
            Você e <b>{perfil.nome}</b> se curtiram.
          </div>
          <button
            type="button"
            onClick={() => setMatchOverlay(false)}
            className="btn-ghost"
            style={{ padding: 12, minWidth: 220 }}
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}

function CompatCard({ score }: { score: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="mb-5 rounded-2xl"
      style={{
        padding: "14px 16px",
        background:
          "linear-gradient(135deg, rgba(212,175,110,0.16), rgba(212,175,110,0.02))",
        border: "1px solid var(--line-strong)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--gold-300)",
            fontWeight: 700,
          }}
        >
          Compatibilidade
        </div>
        <div
          className="display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: "var(--gold-300)",
            lineHeight: 1,
          }}
        >
          {score}%
        </div>
      </div>
      <div
        className="mt-2 rounded-full overflow-hidden"
        style={{ height: 5, background: "rgba(255,255,255,0.05)" }}
      >
        <div
          style={{
            width: `${Math.max(4, Math.min(100, score))}%`,
            height: "100%",
            background: "var(--shine-gold)",
            boxShadow: "0 0 12px rgba(212,175,110,0.5)",
          }}
        />
      </div>
      <div
        className="flex items-center justify-between mt-2"
        style={{ fontSize: 11, color: "var(--text-2)" }}
      >
        <span>Vocês {compatLabel(score)}.</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--gold-400)",
            fontSize: 11,
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "esconder" : "como calculamos"}
        </button>
      </div>
      {expanded && (
        <div
          className="mt-3 rounded-xl p-3 flex flex-col gap-1"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--text-2)",
            lineHeight: 1.5,
          }}
        >
          <div>
            <b style={{ color: "var(--gold-300)" }}>40 pts</b> · intenções em
            comum (ex: os dois marcaram "Swing")
          </div>
          <div>
            <b style={{ color: "var(--gold-300)" }}>25 pts</b> · limites
            compatíveis
          </div>
          <div>
            <b style={{ color: "var(--gold-300)" }}>15 pts</b> · tipo (casal↔casal, solo↔casal…)
          </div>
          <div>
            <b style={{ color: "var(--gold-300)" }}>10 pts</b> · experiência
            próxima
          </div>
          <div>
            <b style={{ color: "var(--gold-300)" }}>5 pts</b> · mesma cidade
          </div>
          <div>
            <b style={{ color: "var(--gold-300)" }}>5 pts</b> · proximidade de
            idade
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--text-2)",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function VerRow({
  ok,
  label,
  last,
}: {
  ok: boolean;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 py-2"
      style={{
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: ok
            ? "linear-gradient(135deg, var(--gold-300), var(--gold-600))"
            : "rgba(255,255,255,0.06)",
          color: ok ? "#1a0f05" : "var(--text-3)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {ok ? "✓" : "×"}
      </div>
      <div
        style={{ fontSize: 13, color: ok ? "var(--text-1)" : "var(--text-3)" }}
      >
        {label}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 9,
        background: active
          ? "linear-gradient(135deg, rgba(212,175,110,0.2), rgba(212,175,110,0.05))"
          : "transparent",
        border: active ? "1px solid var(--gold-500)" : "1px solid var(--line)",
        borderRadius: 10,
        cursor: "pointer",
        color: active ? "var(--gold-300)" : "var(--text-2)",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </button>
  );
}

function EmptyBlock({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      className="card flex flex-col items-center justify-center text-center gap-1.5"
      style={{ padding: 26 }}
    >
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{subtitle}</div>
    </div>
  );
}

function PrivateTab({
  perfilNome,
  totalPrivadas,
  pedidoStatus,
  liberadas,
  onRequest,
  onComentar,
  onToggleLike,
  onAbrirLikers,
  fotoLikes,
  pending,
  meuToken,
}: {
  perfilNome: string;
  totalPrivadas: number;
  pedidoStatus: "pendente" | "aprovado" | "negado" | null;
  liberadas: FotoComSrc[];
  onRequest: () => void;
  onComentar: (f: FotoComSrc) => void;
  onToggleLike: (fotoId: string) => void;
  onAbrirLikers: (fotoId: string) => void;
  fotoLikes: Record<string, { curtido: boolean; total: number }>;
  pending: boolean;
  meuToken: string;
}) {
  if (totalPrivadas === 0) {
    return (
      <EmptyBlock
        title="Sem fotos privadas"
        subtitle={`${perfilNome} ainda não publicou fotos privadas.`}
      />
    );
  }

  if (pedidoStatus === "aprovado" && liberadas.length > 0) {
    return (
      <>
        <div
          className="mb-3 rounded-xl p-3 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
            border: "1px solid var(--line-strong)",
            fontSize: 12,
            color: "var(--gold-300)",
          }}
        >
          Acesso liberado · trate com respeito
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {liberadas.map((f) => (
            <PhotoCard
              key={f.id}
              foto={f}
              meuToken={meuToken}
              curtido={fotoLikes[f.id]?.curtido ?? false}
              total={fotoLikes[f.id]?.total ?? 0}
              onClickFoto={() => onComentar(f)}
              onToggleLike={() => onToggleLike(f.id)}
              onAbrirLikers={() => onAbrirLikers(f.id)}
              ratio="1"
              privadaWatermark
            />
          ))}
        </div>
      </>
    );
  }

  const labelBtn =
    pedidoStatus === "pendente"
      ? "✓ Acesso solicitado"
      : pedidoStatus === "negado"
        ? "Pedido negado"
        : "Solicitar acesso";
  const disabled = pedidoStatus !== null || pending;

  return (
    <>
      <div
        className="rounded-2xl text-center"
        style={{
          background:
            "linear-gradient(160deg, rgba(212,175,110,0.15), rgba(212,175,110,0.03))",
          border: "1px solid var(--line-strong)",
          padding: "22px 18px",
          marginBottom: 14,
        }}
      >
        <div style={{ color: "var(--gold-300)", fontSize: 28 }}>🔒</div>
        <div
          className="display"
          style={{
            fontSize: 20,
            fontWeight: 500,
            marginTop: 6,
            color: "var(--text-0)",
          }}
        >
          Fotos privadas
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            lineHeight: 1.5,
            marginTop: 6,
            marginBottom: 14,
          }}
        >
          {totalPrivadas} fotos liberadas só após aprovação manual de{" "}
          {perfilNome}.
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onRequest}
          className={pedidoStatus === null ? "btn-gold" : "btn-ghost"}
          style={{ padding: "11px 22px", opacity: disabled ? 0.6 : 1 }}
        >
          {labelBtn}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: Math.min(totalPrivadas, 9) }).map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden"
            style={{
              aspectRatio: "1",
              borderRadius: 10,
              background: "var(--bg-2)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(212,175,110,0.15), rgba(10,7,6,0.9))",
                filter: "blur(14px) brightness(0.5)",
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 18 }}
            >
              🔒
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function tipoLabel(t: "casal" | "homem" | "mulher"): string {
  return t === "casal" ? "Casal" : t === "mulher" ? "Mulher solo" : "Homem solo";
}

/* ====================================================================
 * PhotoCard — célula reutilizável da galeria com:
 *   - Foto (com watermark)
 *   - Coração no canto superior direito (toggle curtir)
 *   - Chip "💬" no canto inferior direito (abre comentários)
 *   - Click no contador de curtidas abre lista "quem curtiu"
 * ================================================================== */
function PhotoCard({
  foto,
  meuToken,
  curtido,
  total,
  onClickFoto,
  onToggleLike,
  onAbrirLikers,
  ratio,
  privadaWatermark,
}: {
  foto: FotoComSrc;
  meuToken: string;
  curtido: boolean;
  total: number;
  onClickFoto: () => void;
  onToggleLike: () => void;
  onAbrirLikers: () => void;
  ratio: "3/4" | "1";
  privadaWatermark?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: ratio,
        borderRadius: ratio === "1" ? 10 : 14,
        background: "var(--bg-2)",
      }}
    >
      <button
        type="button"
        onClick={onClickFoto}
        className="absolute inset-0"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
        aria-label="Ver foto e comentários"
      >
        {foto.src && privadaWatermark && (
          <WatermarkedPhoto
            src={foto.src}
            alt=""
            label={meuToken}
            intensity="subtle"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: ratio === "1" ? 10 : 14,
            }}
          />
        )}
        {foto.src && !privadaWatermark && (
          <>
            <FeedImage src={foto.src} alt="Foto" fit="cover" loading="lazy" />
            <WatermarkOverlay label={meuToken} intensity="subtle" />
          </>
        )}
      </button>

      {/* Coração — toggle curtir (canto superior direito) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleLike();
        }}
        aria-label={curtido ? "Descurtir foto" : "Curtir foto"}
        className="absolute flex items-center justify-center"
        style={{
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: curtido ? "#ff4c6b" : "#fff",
          fontSize: 16,
          cursor: "pointer",
          zIndex: 3,
          padding: 0,
        }}
      >
        {curtido ? "♥" : "♡"}
      </button>

      {/* Contador de curtidas + chip de comentários — canto inferior */}
      <div
        className="absolute flex items-center gap-1.5"
        style={{
          bottom: 8,
          right: 8,
          zIndex: 3,
        }}
      >
        {total > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAbrirLikers();
            }}
            aria-label="Ver quem curtiu"
            className="flex items-center gap-1"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              padding: "3px 8px",
              borderRadius: 999,
              fontSize: 11,
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "#ff4c6b" }}>♥</span>
            <span>{total}</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClickFoto();
          }}
          aria-label="Ver comentários"
          className="flex items-center"
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 11,
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
          }}
        >
          💬
        </button>
      </div>
    </div>
  );
}
