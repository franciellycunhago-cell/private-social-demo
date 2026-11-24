import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { CancelarVipButton } from "./cancelar-button";

export const metadata = {
  title: "Sua assinatura VIP — PrivateSocial",
};

type SearchParams = Promise<{ bemvindo?: string }>;

/* ====================================================================
 * /app/perfil/vip
 *
 * Pra usuários que já são VIP. Mostra:
 *  - Status da assinatura (trial / ativa / inadimplente / cancelada)
 *  - Plano + valor + próxima cobrança
 *  - Botão cancelar (mantém acesso até expira_em)
 *
 * Se ainda não é VIP, redireciona pra /app/vip (página de venda).
 *
 * Query ?bemvindo=1 vem após confirmar trial — mostra mensagem de
 * boas-vindas no topo.
 * ================================================================== */

export default async function PerfilVipPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");

  const params = await searchParams;
  const bemvindo = params.bemvindo === "1";

  const isVip = info.status.profile.vip_ate
    ? new Date(info.status.profile.vip_ate) > new Date()
    : false;

  const supabase = await createClient();
  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select(
      "id, plano, valor_centavos, status, trial_fim_em, expira_em, ativada_em, cancelada_em",
    )
    .eq("profile_id", info.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      plano: "mensal" | "trimestral" | "anual";
      valor_centavos: number;
      status:
        | "trial"
        | "ativa"
        | "inadimplente"
        | "cancelada"
        | "expirada";
      trial_fim_em: string | null;
      expira_em: string | null;
      ativada_em: string | null;
      cancelada_em: string | null;
    }>();

  // Se não é VIP nem tem assinatura, manda pra página de venda
  if (!isVip && !assinatura) redirect("/app/vip");

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

      {bemvindo && (
        <div
          className="rounded-2xl p-4 flex gap-3 mb-5"
          style={{
            background: "var(--shine-gold)",
            color: "#1a0f05",
          }}
        >
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div
              className="display"
              style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}
            >
              Bem-vindo ao VIP!
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>
              Você tem 7 dias grátis. A 1ª cobrança Pix vai ser gerada
              perto do fim do trial — você recebe email do Asaas.
            </div>
          </div>
        </div>
      )}

      <header className="text-center mb-6">
        <div
          className="inline-flex items-center gap-1.5 rounded-full"
          style={{
            background: "var(--shine-gold)",
            color: "#1a0f05",
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.2,
            marginBottom: 10,
          }}
        >
          ★ MEMBRO VIP
        </div>
        <h1
          className="display"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {info.isAdmin && !assinatura ? "Acesso administrativo" : "Sua assinatura"}
        </h1>
      </header>

      {info.isAdmin && !assinatura && (
        <div
          className="rounded-2xl p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.15), rgba(212,175,110,0.02))",
            border: "1px solid var(--gold-500)",
          }}
        >
          <div
            className="display"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--gold-300)",
              marginBottom: 4,
            }}
          >
            Você é admin
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
            Como administrador você tem acesso completo a todos os
            recursos VIP sem precisar assinar. Útil pra moderação,
            testes e suporte.
          </div>
        </div>
      )}

      {assinatura && <AssinaturaCard a={assinatura} />}

      {assinatura &&
        (assinatura.status === "trial" ||
          assinatura.status === "ativa" ||
          assinatura.status === "inadimplente") && (
          <div className="mt-6">
            <CancelarVipButton statusAtual={assinatura.status} />
          </div>
        )}

      <div
        className="rounded-xl p-4 mt-6"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          className="mono mb-2"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
            fontWeight: 700,
          }}
        >
          O que está incluído
        </div>
        <ul
          style={{
            fontSize: 12,
            color: "var(--text-1)",
            lineHeight: 1.7,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          <li>✓ Ver quem te curtiu</li>
          <li>✓ Boost no Descobrir</li>
          <li>✓ Pedidos de privado ilimitados</li>
          <li>✓ Estatísticas do perfil</li>
          <li>✓ Acesso antecipado a eventos + VIP only</li>
          <li>✓ Badge ★ VIP no perfil</li>
        </ul>
      </div>

      <p
        className="text-center"
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          marginTop: 24,
          lineHeight: 1.6,
        }}
      >
        Cobrança e renovação automática via Asaas (Pix/cartão).
        <br />
        Recibos e gestão financeira chegam no seu email.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function AssinaturaCard({
  a,
}: {
  a: {
    plano: "mensal" | "trimestral" | "anual";
    valor_centavos: number;
    status: "trial" | "ativa" | "inadimplente" | "cancelada" | "expirada";
    trial_fim_em: string | null;
    expira_em: string | null;
    ativada_em: string | null;
    cancelada_em: string | null;
  };
}) {
  const planoLabel: Record<typeof a.plano, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    anual: "Anual",
  };

  const statusBadge = renderStatusBadge(a.status);
  const valor = `R$ ${(a.valor_centavos / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(212,175,110,0.15), rgba(212,175,110,0.02))",
        border: "1px solid var(--gold-500)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="display"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--gold-300)",
          }}
        >
          Plano {planoLabel[a.plano]}
        </div>
        {statusBadge}
      </div>

      <div
        className="mono"
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--gold-300)",
          marginBottom: 4,
        }}
      >
        {valor}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            fontWeight: 500,
            marginLeft: 6,
          }}
        >
          {a.plano === "mensal"
            ? "/ mês"
            : a.plano === "trimestral"
              ? "/ 3 meses"
              : "/ ano"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
        {a.status === "trial" && a.trial_fim_em && (
          <Info
            label="Trial até"
            value={fmtDate(a.trial_fim_em)}
            sub="depois cobra"
          />
        )}
        {a.ativada_em && (
          <Info label="Membro desde" value={fmtDate(a.ativada_em)} />
        )}
        {a.expira_em && a.status !== "cancelada" && (
          <Info
            label="Próxima renovação"
            value={fmtDate(a.expira_em)}
            sub="renovação automática"
          />
        )}
        {a.cancelada_em && (
          <Info
            label="Cancelada em"
            value={fmtDate(a.cancelada_em)}
            sub={
              a.expira_em && new Date(a.expira_em) > new Date()
                ? `acesso até ${fmtDate(a.expira_em)}`
                : undefined
            }
          />
        )}
      </div>

      {a.status === "inadimplente" && (
        <div
          className="rounded-xl p-3 mt-4"
          style={{
            background: "rgba(217,138,114,0.1)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          ⚠️ Pagamento atrasado. Confira sua caixa de entrada — o Asaas
          enviou o link de pagamento. Sem pagamento, o acesso VIP é
          interrompido.
        </div>
      )}
    </div>
  );
}

function renderStatusBadge(
  status: "trial" | "ativa" | "inadimplente" | "cancelada" | "expirada",
) {
  const map: Record<typeof status, { label: string; bg: string; fg: string }> =
    {
      trial: {
        label: "EM TRIAL",
        bg: "rgba(212,175,110,0.16)",
        fg: "var(--gold-300)",
      },
      ativa: {
        label: "ATIVA",
        bg: "rgba(149,176,115,0.14)",
        fg: "oklch(0.82 0.09 140)",
      },
      inadimplente: {
        label: "ATRASADA",
        bg: "rgba(217,138,114,0.12)",
        fg: "var(--rose-400)",
      },
      cancelada: {
        label: "CANCELADA",
        bg: "rgba(255,255,255,0.06)",
        fg: "var(--text-3)",
      },
      expirada: {
        label: "EXPIRADA",
        bg: "rgba(255,255,255,0.06)",
        fg: "var(--text-3)",
      },
    };
  const cfg = map[status];
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
      }}
    >
      {cfg.label}
    </span>
  );
}

function Info({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
