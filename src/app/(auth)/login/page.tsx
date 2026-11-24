import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus, routeForStatus } from "@/lib/supabase/profile";
import { LoginForm } from "./form";
import { InstallAppButton } from "../install-app-button";

export const metadata = {
  title: "Entrar — PrivateSocial",
};

export default async function LoginPage() {
  // Se já está logado, redireciona pra rota correta do estado
  // (inclui /suspenso e /excluido se for o caso).
  const info = await getProfileStatus();
  if (info) {
    redirect(routeForStatus(info.status.state));
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6 fade-up">
      <div className="text-center">
        <h1
          className="display"
          style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Bem-vindo de volta
        </h1>
        <p
          className="mt-2"
          style={{ fontSize: 14, color: "var(--text-2)" }}
        >
          Entre no Círculo
        </p>
      </div>

      <InstallAppButton />

      <LoginForm />

      <div
        className="text-center"
        style={{ fontSize: 12, color: "var(--text-3)" }}
      >
        <Link
          href="/recuperar-senha"
          style={{
            color: "var(--text-2)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Esqueci minha senha
        </Link>
      </div>

      <div
        className="text-center"
        style={{ fontSize: 13, color: "var(--text-2)" }}
      >
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          style={{ color: "var(--gold-300)", fontWeight: 600 }}
        >
          Criar acesso
        </Link>
      </div>
    </div>
  );
}
