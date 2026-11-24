import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import {
  EVENTO_COLS,
  formatEventoData,
  type EventoRow,
} from "@/lib/eventos";
import { resolveEventoFoto } from "@/lib/eventos-server";
import { hasVipAccess } from "@/lib/vip/check";
import { PresencaButton } from "../presenca-button";
import { CheckinPill } from "../checkin-pill";

export const metadata = {
  title: "Evento — PrivateSocial",
};

type Params = Promise<{ id: string }>;

/* ====================================================================
 * /app/eventos/[id]
 *
 *  - Hero grande com capa + badges (VIP / Patrocinado)
 *  - Card com data/local/dress_code/capacidade
 *  - Descrição completa
 *  - Avatares de matches confirmados (quem você já tem match)
 *  - Botão confirmar presença fixo no rodapé
 * ================================================================== */

export default async function EventoDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;
  const isAdmin = info.isAdmin;

  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select(EVENTO_COLS)
    .eq("id", id)
    .eq("publicado", true)
    .maybeSingle<EventoRow>();

  if (!evento) notFound();

  // Evento VIP only: bloqueia free com paywall (admin sempre passa)
  const isVip = hasVipAccess(info.status.profile.vip_ate, info.isAdmin);
  if (evento.vip_only && !isVip) {
    return <EventoVipOnly tituloEvento={evento.titulo} />;
  }

  // Confirmação do próprio user + confirmacoes dos matches + checkins ativos
  const [confRes, matchesRes, checkinsRes] = await Promise.all([
    supabase
      .from("confirmacoes_evento")
      .select("profile_id")
      .eq("evento_id", id),
    supabase
      .from("matches")
      .select("profile_1, profile_2")
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`),
    supabase
      .from("checkins")
      .select("profile_id, expires_at")
      .eq("evento_id", id)
      .gt("expires_at", new Date().toISOString())
      .limit(50),
  ]);

  const confirmados = new Set(
    ((confRes.data ?? []) as { profile_id: string }[]).map(
      (c) => c.profile_id,
    ),
  );
  const eusConfirmei = confirmados.has(meId);
  const totalConfirmados = confirmados.size;

  const matchIds = new Set<string>();
  ((matchesRes.data ?? []) as {
    profile_1: string;
    profile_2: string;
  }[]).forEach((m) => {
    matchIds.add(m.profile_1 === meId ? m.profile_2 : m.profile_1);
  });

  // Matches que confirmaram presença
  const matchesConfirmadosIds = Array.from(confirmados).filter(
    (pid) => pid !== meId && matchIds.has(pid),
  );

  let matchesConfirmados: {
    id: string;
    nome: string;
    capa: string | null;
  }[] = [];

  if (matchesConfirmadosIds.length > 0) {
    const [profilesRes, fotosRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome_exibicao")
        .in("id", matchesConfirmadosIds),
      supabase
        .from("fotos")
        .select("profile_id, url")
        .in("profile_id", matchesConfirmadosIds)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);

    const capaMap = new Map<string, string>();
    ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
      (f) => {
        if (!capaMap.has(f.profile_id)) {
          const { data } = supabase.storage
            .from("fotos-publicas")
            .getPublicUrl(f.url);
          capaMap.set(f.profile_id, data.publicUrl);
        }
      },
    );

    matchesConfirmados = ((profilesRes.data ?? []) as {
      id: string;
      nome_exibicao: string | null;
    }[]).map((p) => ({
      id: p.id,
      nome: p.nome_exibicao ?? "Perfil",
      capa: capaMap.get(p.id) ?? null,
    }));
  }

  // Resolve perfis dos checkins ativos
  const checkinIds = ((checkinsRes.data ?? []) as { profile_id: string }[])
    .map((c) => c.profile_id)
    .filter((pid) => pid !== meId);

  let presentes: { id: string; nome: string; capa: string | null }[] = [];
  let euChequei = ((checkinsRes.data ?? []) as { profile_id: string }[]).some(
    (c) => c.profile_id === meId,
  );
  if (checkinIds.length > 0) {
    const [profilesRes, fotosRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome_exibicao")
        .in("id", checkinIds),
      supabase
        .from("fotos")
        .select("profile_id, url")
        .in("profile_id", checkinIds)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);
    const capaMap = new Map<string, string>();
    ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
      (f) => {
        if (!capaMap.has(f.profile_id)) {
          const { data } = supabase.storage
            .from("fotos-publicas")
            .getPublicUrl(f.url);
          capaMap.set(f.profile_id, data.publicUrl);
        }
      },
    );
    presentes = ((profilesRes.data ?? []) as {
      id: string;
      nome_exibicao: string | null;
    }[]).map((p) => ({
      id: p.id,
      nome: p.nome_exibicao ?? "Perfil",
      capa: capaMap.get(p.id) ?? null,
    }));
  }

  const capa = await resolveEventoFoto(evento.foto_url);
  const capacidadeCheia =
    !!evento.capacidade && totalConfirmados >= evento.capacidade;
  const isPast = new Date(evento.data).getTime() < Date.now();

  // Pill flutuante "Você vai" fica a X px do bottom. Admin tem chip
  // "MODERAÇÃO" abaixo do nav, então precisa ser empurrada mais pra cima.
  const pillBottom = isAdmin ? 140 : 100;
  // Padding do container precisa acomodar a própria pill + gap, senão
  // os elementos finais ficam escondidos atrás dela.
  const containerPadBottom = pillBottom + 80;

  return (
    <div
      className="relative flex flex-col"
      style={{ paddingBottom: containerPadBottom }}
    >
      {/* Hero — banner com aspect-ratio 3/2 + contain pra mostrar a
          imagem inteira sem cortar (igual aparece na lista de eventos).
          Fundo escuro preenche se a imagem tiver proporção diferente. */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "3 / 2",
          background:
            "radial-gradient(ellipse at 30% 30%, rgba(212,175,110,0.18), transparent 55%), #0a0706",
        }}
      >
        {capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={capa}
            alt={evento.titulo}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "contain" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, rgba(212,175,110,0.35), transparent 55%), linear-gradient(135deg, #2a1810 0%, #0a0706 70%)",
            }}
          />
        )}
        {/* Gradiente sutil só nas bordas pra o título "encostar" no banner */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "30%",
            background:
              "linear-gradient(to bottom, transparent, rgba(10,7,6,0.98))",
            pointerEvents: "none",
          }}
        />

        <Link
          href="/app/eventos"
          aria-label="Voltar"
          className="absolute flex items-center justify-center"
          style={{
            top: 54,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 14,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            textDecoration: "none",
            fontSize: 20,
          }}
        >
          ‹
        </Link>

        <div
          className="absolute flex flex-col gap-1.5 items-end"
          style={{ top: 60, right: 16 }}
        >
          {evento.vip_only && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              ★ SÓ VIP
            </span>
          )}
          {evento.tipo === "patrocinado" && (
            <span
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--line-strong)",
                color: "var(--text-1)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              Patrocinado
            </span>
          )}
          {isPast && (
            <span
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "var(--text-2)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              ENCERRADO
            </span>
          )}
        </div>
      </div>

      {/* Título + meta */}
      <div className="-mt-16 relative z-10 px-5">
        <div
          className="mono inline-block"
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            padding: "5px 12px",
            borderRadius: 10,
            fontSize: 10,
            letterSpacing: 1.5,
            color: "var(--gold-300)",
            marginBottom: 10,
          }}
        >
          {formatEventoData(evento.data)}
        </div>
        <h1
          className="display"
          style={{
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--text-0)",
          }}
        >
          {evento.titulo}
        </h1>
        {evento.patrocinador_nome && evento.tipo === "patrocinado" && (
          <div
            className="mt-1.5"
            style={{
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            Por <b style={{ color: "var(--gold-300)" }}>{evento.patrocinador_nome}</b>
          </div>
        )}
      </div>

      {/* Infos em grid */}
      <div className="px-5 pt-5 grid grid-cols-2 gap-2">
        {evento.local && (
          <InfoCard icon="📍" label="Local" value={evento.local} />
        )}
        {evento.cidade && (
          <InfoCard icon="🏙" label="Cidade" value={evento.cidade} />
        )}
        {evento.dress_code && (
          <InfoCard
            icon="👗"
            label="Dress code"
            value={evento.dress_code}
          />
        )}
        {evento.capacidade && (
          <InfoCard
            icon="👥"
            label="Vagas"
            value={`${totalConfirmados} / ${evento.capacidade}`}
            highlight={capacidadeCheia}
          />
        )}
      </div>

      {/* Descrição */}
      {evento.descricao && (
        <div className="px-5 pt-6">
          <SectionTitle>Sobre</SectionTitle>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-1)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {evento.descricao}
          </div>
        </div>
      )}

      {/* Estão aqui agora (checkins ativos) */}
      {(presentes.length > 0 || euChequei) && (
        <div className="px-5 pt-6">
          <SectionTitle>
            {presentes.length + (euChequei ? 1 : 0) === 1
              ? "1 está aqui agora"
              : `${presentes.length + (euChequei ? 1 : 0)} estão aqui agora`}
          </SectionTitle>
          <div className="flex items-center gap-3">
            <div className="flex gap-3 overflow-x-auto scroll pb-1 flex-1">
              {presentes.slice(0, 12).map((m) => (
                <Link
                  key={m.id}
                  href={`/app/p/${m.id}`}
                  className="flex-shrink-0 text-center"
                  style={{ width: 60, textDecoration: "none" }}
                >
                  <div
                    className="relative mx-auto overflow-hidden"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      border: "2px solid var(--gold-300)",
                      background: "var(--bg-2)",
                      boxShadow: "0 0 0 2px rgba(212,175,110,0.18)",
                    }}
                  >
                    {m.capa ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.capa}
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
                  <div
                    className="mt-1.5 truncate"
                    style={{ fontSize: 10, color: "var(--text-1)" }}
                  >
                    {firstName(m.nome)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pill de checkin (sempre visível antes do evento começar/durante) */}
      {!isPast && (
        <div className="px-5 pt-5 flex items-center justify-between gap-3">
          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            Já está no evento? Marca pra outros saberem (12h).
          </div>
          <CheckinPill eventoId={evento.id} jaCheckedIn={euChequei} />
        </div>
      )}

      {/* Matches confirmados */}
      {matchesConfirmados.length > 0 && (
        <div className="px-5 pt-6">
          <SectionTitle>
            {matchesConfirmados.length === 1
              ? "1 match vai"
              : `${matchesConfirmados.length} matches vão`}
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto scroll pb-1">
            {matchesConfirmados.map((m) => (
              <Link
                key={m.id}
                href={`/app/p/${m.id}`}
                className="flex-shrink-0 text-center"
                style={{ width: 72, textDecoration: "none" }}
              >
                <div
                  className="relative mx-auto overflow-hidden"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "1px solid var(--gold-600)",
                    background: "var(--bg-2)",
                  }}
                >
                  {m.capa ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.capa}
                      alt=""
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ color: "var(--gold-300)", fontSize: 20 }}
                    >
                      ♥
                    </div>
                  )}
                </div>
                <div
                  className="mt-2 truncate"
                  style={{ fontSize: 11, color: "var(--text-1)" }}
                >
                  {firstName(m.nome)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Total de confirmados */}
      <div className="px-5 pt-6">
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(212,175,110,0.14)",
              color: "var(--gold-300)",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            🎟
          </div>
          <div className="flex-1">
            <div
              className="display"
              style={{
                fontSize: 17,
                color: "var(--text-0)",
                fontWeight: 500,
              }}
            >
              {totalConfirmados}{" "}
              {totalConfirmados === 1 ? "confirmado" : "confirmados"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {eusConfirmei
                ? "Você está na lista · endereço completo liberado antes do evento"
                : "Confirme sua presença pra entrar no grupo"}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar com CTA */}
      {!isPast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 w-full max-w-md"
          style={{
            bottom: pillBottom,
            padding: "0 20px",
            zIndex: 25,
          }}
        >
          <div
            className="rounded-full flex items-center gap-3"
            style={{
              background: "rgba(18, 13, 10, 0.96)",
              backdropFilter: "blur(18px)",
              border: "1px solid var(--line-strong)",
              padding: "8px 10px 8px 18px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--text-3)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {eusConfirmei ? "Você vai" : "Confirmar?"}
              </div>
              <div
                className="truncate"
                style={{
                  fontSize: 12,
                  color: "var(--text-1)",
                  marginTop: 1,
                }}
              >
                {formatEventoData(evento.data)}
              </div>
            </div>
            <PresencaButton
              eventoId={evento.id}
              confirmado={eusConfirmei}
              label={{ confirmar: "Confirmar", confirmado: "✓ Confirmado" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))"
          : "var(--bg-1)",
        border: highlight
          ? "1px solid var(--gold-500)"
          : "1px solid var(--line)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: highlight ? "var(--gold-300)" : "var(--text-0)",
          fontWeight: highlight ? 600 : 500,
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "var(--text-2)",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function firstName(nome: string): string {
  return nome.split(/[\s&]/)[0] ?? nome;
}

function EventoVipOnly({ tituloEvento }: { tituloEvento: string }) {
  return (
    <div className="flex flex-col px-5 pt-10 pb-20">
      <Link
        href="/app/eventos"
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
        ‹ Eventos
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
          ★
        </div>

        <div
          className="display gold-text"
          style={{
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            maxWidth: 340,
            lineHeight: 1.2,
          }}
        >
          Esse evento é só pra membros VIP
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-2)",
            lineHeight: 1.55,
            maxWidth: 320,
          }}
        >
          O evento <strong>{tituloEvento}</strong> está reservado pra
          membros VIP do clube. Vire VIP e tenha acesso a todos os
          eventos exclusivos.
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
