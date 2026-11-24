import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { signOut } from "../(auth)/actions";

export const metadata = {
  title: "Conta excluída — PrivateSocial",
};

const CARENCIA_DIAS = 7;

/* ====================================================================
 * /excluido
 *
 * Tela final pra usuário com soft delete. Mostra a data e calcula
 * quanto tempo falta pra hard delete (carência de 7 dias). Pode
 * pedir reativação via contato durante esse período.
 * ================================================================== */

export default async function ExcluidoPage() {
  const info = await getProfileStatus();
  if (!info) redirect("/login");
  if (info.status.state !== "deletado") {
    redirect("/app");
  }

  const deletadoEm = new Date(info.status.deletadoEm);
  const fimCarencia = new Date(
    deletadoEm.getTime() + CARENCIA_DIAS * 24 * 60 * 60 * 1000,
  );
  const diasRestantes = Math.max(
    0,
    Math.ceil((fimCarencia.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: "100dvh", padding: "32px 24px" }}
    >
      <div style={{ fontSize: 56, marginBottom: 14 }}>🗑</div>
      <h1
        className="display"
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "var(--text-0)",
          letterSpacing: "-0.02em",
        }}
      >
        Conta excluída
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
        Esta conta foi marcada para exclusão em{" "}
        <b style={{ color: "var(--text-1)" }}>
          {deletadoEm.toLocaleDateString("pt-BR")}
        </b>
        .
      </p>

      <div
        className="rounded-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
          border: "1px solid var(--gold-600)",
          padding: "14px 18px",
          marginTop: 20,
          maxWidth: 420,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--gold-300)",
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Período de carência
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.6,
          }}
        >
          {diasRestantes > 0
            ? `Faltam ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"} pra apagar definitivamente. Até lá, dá pra cancelar a exclusão entrando em contato.`
            : "Carência expirada. A conta vai ser apagada do banco em breve."}
        </div>
      </div>

      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          marginTop: 24,
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        Pra reverter, escreva pra{" "}
        <a
          href="mailto:contact@example.com"
          style={{ color: "var(--gold-300)" }}
        >
          contact@example.com
        </a>
        . Após o prazo, exclusão é permanente.
      </p>

      <form action={signOut} className="mt-6">
        <button type="submit" className="btn-ghost" style={{ padding: 12 }}>
          Sair
        </button>
      </form>

      <Link
        href="/privacidade"
        className="mono mt-4"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          textDecoration: "underline",
        }}
      >
        Política de privacidade ↗
      </Link>
    </div>
  );
}
