import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { PlanosVip } from "./planos-vip";
import { registrarPageVisitada } from "./actions";

export const metadata = {
  title: "Vire VIP — PrivateSocial",
};

/* ====================================================================
 * /app/vip
 *
 *  - Hero com pitch de vendas
 *  - Lista de 6 benefícios
 *  - 3 planos (mensal, trimestral, anual) com badge "MAIS POPULAR"
 *  - Trial 7 dias grátis
 *  - Se já é VIP, redireciona pra /app/perfil/vip (status atual)
 *
 * Tracking: registra `page_visitada` em vip_eventos quando carrega.
 * ================================================================== */

export default async function VipPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const isVip = info.status.profile.vip_ate
    ? new Date(info.status.profile.vip_ate) > new Date()
    : false;

  // Já é VIP — vai pro perfil VIP (status, cancelar, etc)
  if (isVip) redirect("/app/perfil/vip");

  // Carrega assinatura existente (caso esteja em trial cancelado, etc)
  const supabase = await createClient();
  const { data: assinaturaAtual } = await supabase
    .from("assinaturas")
    .select("status, plano, expira_em")
    .eq("profile_id", meId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: string;
      plano: string;
      expira_em: string | null;
    }>();

  // Tracking — fire and forget
  void registrarPageVisitada();

  return (
    <div className="flex flex-col" style={{ paddingBottom: 120 }}>
      <header
        className="flex items-center px-5"
        style={{ paddingTop: 18, paddingBottom: 14 }}
      >
        <Link
          href="/app/perfil"
          aria-label="Voltar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            color: "var(--text-1)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          ‹
        </Link>
      </header>

      {/* Hero */}
      <section className="px-5 text-center">
        <div className="flex justify-center mb-3">
          <Image
            src="/logo-icon.png"
            alt=""
            width={68}
            height={68}
            style={{ objectFit: "contain" }}
          />
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2.5,
            color: "var(--gold-300)",
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          ★ Plano VIP
        </div>
        <h1
          className="display gold-text"
          style={{
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Mais conexões.
          <br />
          Sem ruído.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-2)",
            lineHeight: 1.55,
            marginTop: 12,
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          A versão completa do PrivateSocial, pra quem leva a sério.
          7 dias grátis pra testar — cancela a hora que quiser.
        </p>
      </section>

      {assinaturaAtual?.status === "cancelada" && (
        <div
          className="mx-5 mt-4 rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            fontSize: 12,
            color: "var(--rose-400)",
            textAlign: "center",
          }}
        >
          Você cancelou antes. Pode voltar a qualquer momento.
        </div>
      )}

      {/* Benefícios */}
      <section className="px-5 mt-7 flex flex-col gap-2.5">
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          O que você ganha
        </div>

        <Beneficio
          icon="👀"
          titulo="Ver quem te curtiu"
          desc="Antes de você decidir. Sem mistério."
        />
        <Beneficio
          icon="🚀"
          titulo="Boost no Descobrir"
          desc="Seu perfil aparece mais vezes pra mais pessoas."
        />
        <Beneficio
          icon="🔓"
          titulo="Pedidos de privado ilimitados"
          desc="Free só pode pedir pra 1 pessoa por vez. VIP não tem limite."
        />
        <Beneficio
          icon="📊"
          titulo="Estatísticas do seu perfil"
          desc="Quantos viram, quantos curtiram, sua taxa de match."
        />
        <Beneficio
          icon="🎉"
          titulo="Eventos antecipados + VIP only"
          desc="Acesso primeiro a tudo + alguns só pra membros VIP."
        />
        <Beneficio
          icon="★"
          titulo="Badge VIP no perfil"
          desc="Sinaliza que você leva a sério. Mais peso pros matches."
        />
      </section>

      {/* Planos */}
      <section className="px-5 mt-8">
        <div
          className="mono text-center"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          Escolha seu plano
        </div>
        <PlanosVip />
      </section>

      {/* Trial */}
      <section className="px-5 mt-6">
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
            border: "1px solid var(--gold-500)",
          }}
        >
          <span style={{ fontSize: 22 }}>🎁</span>
          <div>
            <div
              className="display"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--gold-300)",
                marginBottom: 4,
              }}
            >
              7 dias grátis pra testar
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}
            >
              Você só é cobrado depois do 7º dia. Pode cancelar a qualquer
              momento dentro do trial sem pagar nada.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ minimalista */}
      <section className="px-5 mt-7 flex flex-col gap-3">
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-2)",
            fontWeight: 700,
            marginBottom: 2,
          }}
        >
          Perguntas frequentes
        </div>
        <Faq pergunta="Como funciona o trial de 7 dias?">
          Você ativa o VIP e tem 7 dias completos pra usar tudo. Se
          cancelar antes, não paga nada. Se não cancelar, a primeira
          cobrança rola no 8º dia.
        </Faq>
        <Faq pergunta="Posso cancelar quando quiser?">
          Sim. O cancelamento é imediato no painel. Você mantém o VIP até
          o fim do período já pago e depois volta pro free, sem
          restrições adicionais.
        </Faq>
        <Faq pergunta="Quais formas de pagamento?">
          Pix e cartão de crédito (via Asaas, processadora brasileira).
          Renovação automática quando bater o vencimento.
        </Faq>
        <Faq pergunta="O que acontece com o plano free?">
          Continua existindo igual. Você só não tem os benefícios VIP
          listados acima. Sem corte de funcionalidades essenciais.
        </Faq>
      </section>

      <p
        className="text-center mono px-5 mt-8"
        style={{
          fontSize: 9,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-3)",
          lineHeight: 1.7,
        }}
      >
        +18 · Pagamento seguro Asaas
        <br />
        Cancela a qualquer momento
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function Beneficio({
  icon,
  titulo,
  desc,
}: {
  icon: string;
  titulo: string;
  desc: string;
}) {
  return (
    <div
      className="flex gap-3 items-start rounded-xl"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        padding: 12,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(212,175,110,0.1)",
          fontSize: 18,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-0)",
            marginBottom: 1,
          }}
        >
          {titulo}
        </div>
        <div
          style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

function Faq({
  pergunta,
  children,
}: {
  pergunta: string;
  children: React.ReactNode;
}) {
  return (
    <details
      className="rounded-xl"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        padding: "10px 14px",
      }}
    >
      <summary
        style={{
          fontSize: 13,
          color: "var(--text-1)",
          fontWeight: 500,
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        {pergunta}
      </summary>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          lineHeight: 1.6,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--line)",
        }}
      >
        {children}
      </p>
    </details>
  );
}
