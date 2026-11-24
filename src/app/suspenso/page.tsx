import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { signOut } from "../(auth)/actions";

export const metadata = {
  title: "Conta suspensa — PrivateSocial",
};

/* ====================================================================
 * /suspenso
 *
 * Tela final pra usuário suspenso. Sem retorno automático até o admin
 * reativar. Mostra motivo (se admin preencheu) e contato pra apelo.
 * ================================================================== */

export default async function SuspensoPage() {
  const info = await getProfileStatus();
  if (!info) redirect("/login");
  if (info.status.state !== "suspenso") {
    // Não está suspenso → manda pra rota correta
    redirect("/app");
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: "100dvh", padding: "32px 24px" }}
    >
      <div style={{ fontSize: 56, marginBottom: 14 }}>🚫</div>
      <h1
        className="display"
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "var(--text-0)",
          letterSpacing: "-0.02em",
        }}
      >
        Conta suspensa
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-2)",
          lineHeight: 1.6,
          marginTop: 12,
          maxWidth: 380,
        }}
      >
        Sua conta está suspensa e não tem acesso ao app no momento.
      </p>

      {info.status.motivo && (
        <div
          className="rounded-xl"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
            padding: "14px 18px",
            marginTop: 20,
            maxWidth: 420,
            lineHeight: 1.5,
            textAlign: "left",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Motivo
          </div>
          {info.status.motivo}
        </div>
      )}

      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          marginTop: 24,
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        Pra contestar, escreva pra{" "}
        <a
          href="mailto:contact@example.com"
          style={{ color: "var(--gold-300)" }}
        >
          contact@example.com
        </a>
        . Nossa moderação responde em até 48h.
      </p>

      <form action={signOut} className="mt-6">
        <button type="submit" className="btn-ghost" style={{ padding: 12 }}>
          Sair
        </button>
      </form>

      <Link
        href="/termos"
        target="_blank"
        className="mono mt-4"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          textDecoration: "underline",
        }}
      >
        Ler termo de uso ↗
      </Link>
    </div>
  );
}
