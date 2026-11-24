import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { loadAdminUserDetail } from "@/lib/admin/server";
import { UserActions } from "./user-actions";

export const metadata = {
  title: "Perfil do usuário — Admin",
};

type Params = Promise<{ id: string }>;

/* ====================================================================
 * /admin/usuarios/[id]
 *
 * Mini-perfil completo pra moderação:
 *  - Header: avatar + nome/handle + status (suspenso/excluído)
 *  - Selfie de verificação (mesmo após aprovação)
 *  - Stats: posts, matches, curtidas enviadas, denúncias recebidas
 *  - Fotos públicas e privadas em grids separados
 *  - Ações: suspender/reativar, excluir/cancelar exclusão
 *  - Links: ver perfil público, denúncias do alvo
 * ================================================================== */

export default async function AdminUserDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const u = await loadAdminUserDetail(id);
  if (!u) notFound();

  const isSuspenso = u.suspenso;
  const isDeletado = !!u.deletadoEm;
  const isVip = u.vipAte ? new Date(u.vipAte) > new Date() : false;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/usuarios"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        ‹ Voltar à busca
      </Link>

      <header className="flex items-start gap-4 flex-wrap">
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            border: isSuspenso
              ? "2px solid rgba(217,138,114,0.5)"
              : "2px solid var(--gold-500)",
            background: "var(--bg-2)",
          }}
        >
          {u.capa ? (
            <Image
              src={u.capa}
              alt=""
              fill
              sizes="96px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 32 }}
            >
              ♥
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="display"
              style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              {u.nome ?? "Sem nome"}
            </h1>
            {u.handle && (
              <span
                className="mono"
                style={{ fontSize: 13, color: "var(--text-3)" }}
              >
                @{u.handle}
              </span>
            )}
            {u.verificado && (
              <span
                className="chip"
                style={{
                  fontSize: 10,
                  color: "var(--gold-300)",
                  borderColor: "var(--gold-600)",
                }}
              >
                ✓ Verificado
              </span>
            )}
            {isVip && (
              <span
                className="chip"
                style={{
                  fontSize: 10,
                  color: "#1a0f05",
                  background: "var(--shine-gold)",
                  borderColor: "var(--gold-600)",
                  fontWeight: 800,
                }}
              >
                ★ VIP
              </span>
            )}
            {isSuspenso && (
              <span
                className="chip"
                style={{
                  fontSize: 10,
                  color: "var(--rose-400)",
                  borderColor: "rgba(217,138,114,0.5)",
                  background: "rgba(217,138,114,0.1)",
                }}
              >
                SUSPENSO
              </span>
            )}
            {isDeletado && (
              <span
                className="chip"
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  borderColor: "var(--line-strong)",
                }}
              >
                EXCLUÍDO em {fmtData(u.deletadoEm)}
              </span>
            )}
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}
          >
            {[
              u.idade1 ? `${u.idade1}${u.idade2 ? ` · ${u.idade2}` : ""}` : null,
              [u.cidade, u.estado].filter(Boolean).join(", ") || null,
              tipoLabel(u.tipo),
              u.experiencia ? capitalize(u.experiencia) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {(u.email || u.telefone) && (
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "0 16px" }}
            >
              {u.email && <span>{u.email}</span>}
              {u.telefone && <span>📱 {u.telefone}</span>}
            </div>
          )}
        </div>
      </header>

      {isSuspenso && u.suspensoMotivo && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Motivo da suspensão · {fmtData(u.suspensoEm)}
          </div>
          {u.suspensoMotivo}
        </div>
      )}

      <UserActions
        userId={u.id}
        suspenso={isSuspenso}
        deletado={isDeletado}
        postsCount={u.postsCount}
        isVip={isVip}
      />

      <Section title="Stats">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Posts" value={u.postsCount} />
          <Stat label="Matches" value={u.matchesCount} />
          <Stat label="Curtidas enviadas" value={u.curtidasEnviadasCount} />
          <Stat
            label="Denúncias recebidas"
            value={u.denunciasRecebidasCount}
            accent={u.denunciasRecebidasCount > 0}
          />
          <Stat label="Trust score" value={`${u.trustScore}%`} />
          <Stat
            label="Último ativo"
            value={u.ultimoAtivo ? fmtData(u.ultimoAtivo) : "—"}
          />
          <Stat
            label="Membro desde"
            value={u.criadoEm ? fmtData(u.criadoEm) : "—"}
          />
          <Stat
            label="Fotos pub/priv"
            value={`${u.fotosPublicas.length} / ${u.fotosPrivadas.length}`}
          />
        </div>
      </Section>

      {u.bio && (
        <Section title="Bio">
          <div
            style={{
              fontSize: 14,
              color: "var(--text-1)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {u.bio}
          </div>
        </Section>
      )}

      {u.selfieVerificacao && (
        <Section title="Selfie de verificação">
          <div className="flex items-start gap-3 flex-wrap">
            <a
              href={u.selfieVerificacao}
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden block"
              style={{
                width: 200,
                height: 260,
                borderRadius: 12,
                border: "1px solid var(--gold-500)",
                background: "#000",
                cursor: "zoom-in",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.selfieVerificacao}
                alt="Selfie de verificação"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
              />
              <div
                className="mono absolute"
                style={{
                  top: 8,
                  left: 8,
                  background: "rgba(0,0,0,0.78)",
                  color: "var(--gold-300)",
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 9,
                  letterSpacing: 1,
                  border: "1px solid var(--gold-600)",
                }}
              >
                {u.selfieStatus?.toUpperCase()}
              </div>
            </a>
            <div className="flex flex-col gap-2" style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 320 }}>
              <div>
                Selfie original enviada na verificação. Clique pra ampliar (URL
                expira em 30min).
              </div>
              {/* Quem aprovou / rejeitou */}
              <div
                className="rounded-lg flex flex-col gap-1"
                style={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                  padding: "10px 12px",
                  fontSize: 12,
                }}
              >
                {u.selfieRevisadoPorId ? (
                  <>
                    <div style={{ color: "var(--text-3)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }} className="mono">
                      {u.selfieStatus === "aprovado" ? "Aprovado por" : "Rejeitado por"}
                    </div>
                    <div style={{ color: "var(--text-0)", fontWeight: 600 }}>
                      {u.selfieRevisadoPorNome}
                    </div>
                    {u.selfieRevisadoEm && (
                      <div style={{ color: "var(--text-3)", fontSize: 11 }}>
                        {fmtData(u.selfieRevisadoEm)}
                      </div>
                    )}
                    {u.selfieMotivo && (
                      <div style={{ color: "var(--rose-400)", fontSize: 11, marginTop: 4 }}>
                        Motivo: {u.selfieMotivo}
                      </div>
                    )}
                  </>
                ) : u.selfieStatus === "aprovado" ? (
                  <>
                    <div style={{ color: "var(--text-3)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }} className="mono">
                      Aprovado por
                    </div>
                    <div style={{ color: "var(--rose-400)", fontWeight: 600 }}>
                      ⚠ Sistema / sem registro
                    </div>
                    <div style={{ color: "var(--text-3)", fontSize: 11 }}>
                      Nenhum admin identificado — pode ser bug ou aprovação manual no banco.
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </Section>
      )}

      {u.fotosPublicas.length > 0 && (
        <Section title={`Fotos públicas (${u.fotosPublicas.length})`}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {u.fotosPublicas.map((f) => (
              <div
                key={f.id}
                className="relative overflow-hidden block"
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  background: "var(--bg-2)",
                  opacity: f.deletada ? 0.5 : 1,
                }}
              >
                {f.src ? (
                  <a href={f.src} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%", cursor: "zoom-in" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />
                  </a>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--text-3)", fontSize: 10 }}>
                    arquivo<br />removido
                  </div>
                )}
                {f.deletada && (
                  <div className="mono absolute" style={{ bottom: 4, left: 4, background: "rgba(217,138,114,0.85)", color: "#fff", padding: "2px 5px", borderRadius: 4, fontSize: 7, letterSpacing: 1, fontWeight: 700 }}>
                    DELETADA
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {u.fotosPrivadas.length > 0 && (
        <Section title={`Fotos privadas (${u.fotosPrivadas.length})`}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {u.fotosPrivadas.map((f) => (
              <div
                key={f.id}
                className="relative overflow-hidden block"
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  background: "var(--bg-2)",
                  opacity: f.deletada ? 0.5 : 1,
                }}
              >
                {f.src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={f.src} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", filter: "blur(2px)" }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--text-3)", fontSize: 10 }}>
                    arquivo<br />removido
                  </div>
                )}
                <div className="mono absolute" style={{ top: 6, right: 6, background: "rgba(0,0,0,0.7)", color: "var(--gold-300)", padding: "2px 6px", borderRadius: 999, fontSize: 8, letterSpacing: 1, border: "1px solid var(--gold-600)" }}>
                  PRIV
                </div>
                {f.deletada && (
                  <div className="mono absolute" style={{ bottom: 4, left: 4, background: "rgba(217,138,114,0.85)", color: "#fff", padding: "2px 5px", borderRadius: 4, fontSize: 7, letterSpacing: 1, fontWeight: 700 }}>
                    DELETADA
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Atalhos">
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/app/p/${u.id}`}
            target="_blank"
            className="btn-ghost"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            Ver perfil público ↗
          </Link>
          <Link
            href={`/admin/denuncias`}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            Denúncias ({u.denunciasRecebidasCount})
          </Link>
          <Link
            href={`/admin/buscar-token?t=${u.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            Token: TC-{u.id.replace(/-/g, "").slice(0, 6).toUpperCase()}
          </Link>
        </div>
      </Section>
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
    <section className="flex flex-col gap-3">
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
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--bg-1)",
        border: accent
          ? "1px solid rgba(217,138,114,0.4)"
          : "1px solid var(--line)",
        padding: "10px 12px",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: accent ? "var(--rose-400)" : "var(--text-0)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tipoLabel(t: "casal" | "homem" | "mulher" | null): string | null {
  if (!t) return null;
  return t === "casal" ? "Casal" : t === "mulher" ? "Mulher solo" : "Homem solo";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
