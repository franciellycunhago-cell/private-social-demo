import Link from "next/link";
import { RecuperarForm } from "./form";

export const metadata = {
  title: "Recuperar senha — PrivateSocial",
};

export default function RecuperarSenhaPage() {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6 fade-up">
      <div className="text-center">
        <h1
          className="display"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Esqueceu a senha?
        </h1>
        <p
          className="mt-2"
          style={{ fontSize: 14, color: "var(--text-2)" }}
        >
          A gente te manda um link pra redefinir.
        </p>
      </div>

      <RecuperarForm />

      <div
        className="text-center"
        style={{ fontSize: 13, color: "var(--text-2)" }}
      >
        Lembrou da senha?{" "}
        <Link
          href="/login"
          style={{ color: "var(--gold-300)", fontWeight: 600 }}
        >
          Voltar pro login
        </Link>
      </div>
    </div>
  );
}
