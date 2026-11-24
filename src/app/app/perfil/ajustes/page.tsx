import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { NotifForm } from "./notif-form";
import { SenhaForm } from "./senha-form";
import { EmailForm } from "./email-form";
import { SessoesCard } from "./sessoes-card";
import { QuemPodeVerForm } from "./quem-pode-ver-form";
import { RadarVisivelForm } from "./radar-visivel-form";
import type { NotifPrefs, QuemPodeVer } from "./actions";

export const metadata = {
  title: "Ajustes — PrivateSocial",
};

const NOTIF_DEFAULTS: NotifPrefs = {
  matches: true,
  mensagens: true,
  curtidas_post: true,
  comentarios_post: true,
  curtida_recebida: true,
  eventos_novos: true,
};

const QUEM_PODE_VER_DEFAULTS: QuemPodeVer = {
  casal: true,
  homem: true,
  mulher: true,
};

/* ====================================================================
 * /app/perfil/ajustes
 *
 * 4 seções:
 *  1. Notificações — toggles de cada tipo de evento
 *  2. Senha — trocar (precisa da atual)
 *  3. Email — trocar (precisa confirmar no novo)
 *  4. Sessões — ver quando foi último login + sair de todos
 * ================================================================== */

export default async function AjustesPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("notif_prefs, quem_pode_ver, geo_visivel")
    .eq("id", user.id)
    .maybeSingle<{
      notif_prefs: Partial<NotifPrefs> | null;
      quem_pode_ver: Partial<QuemPodeVer> | null;
      geo_visivel: boolean | null;
    }>();

  const prefs: NotifPrefs = {
    ...NOTIF_DEFAULTS,
    ...(row?.notif_prefs ?? {}),
  };

  const quemPodeVer: QuemPodeVer = {
    ...QUEM_PODE_VER_DEFAULTS,
    ...(row?.quem_pode_ver ?? {}),
  };

  return (
    <div className="flex flex-col gap-6 px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center gap-3">
        <Link
          href="/app/perfil"
          aria-label="Voltar"
          className="mono"
          style={{
            background: "transparent",
            border: "1px solid var(--line)",
            color: "var(--text-2)",
            width: 36,
            height: 36,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          ‹
        </Link>
        <div>
          <h1
            className="display"
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Ajustes
          </h1>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Notificações, senha, email e sessões
          </div>
        </div>
      </header>

      <Section
        title="Quem pode te ver"
        hint="Tipos não marcados não te encontram no descobrir e não conseguem abrir seu perfil pelo link."
      >
        <QuemPodeVerForm initial={quemPodeVer} />
      </Section>

      <Section
        title="Radar de proximidade"
        hint="Liga ou desliga sua aparição no radar dos outros users."
      >
        <RadarVisivelForm initial={row?.geo_visivel ?? true} />
      </Section>

      <Section
        title="Notificações"
        hint="Escolha o que vai virar push no seu dispositivo."
      >
        <NotifForm initialPrefs={prefs} />
      </Section>

      <Section
        title="Senha"
        hint="Mínimo 8 caracteres. Pedimos a atual pra confirmar."
      >
        <SenhaForm />
      </Section>

      <Section
        title="Email"
        hint="Trocando o email, enviamos um link pro novo endereço pra confirmar — o atual continua valendo até lá."
      >
        <EmailForm emailAtual={user.email ?? ""} />
      </Section>

      <Section
        title="Sessões"
        hint="Encerra TODOS os dispositivos logados — inclui esse. Use se desconfiar de acesso indevido."
      >
        <SessoesCard
          ultimoLogin={user.last_sign_in_at ?? null}
          confirmadoEm={user.email_confirmed_at ?? null}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
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
      {hint && (
        <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      <div
        className="rounded-2xl"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          padding: 14,
        }}
      >
        {children}
      </div>
    </section>
  );
}
