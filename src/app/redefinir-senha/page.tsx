import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RedefinirForm } from "./form";

export const metadata = {
  title: "Nova senha — PrivateSocial",
};

/**
 * /redefinir-senha
 * - Protegida (user precisa ter session — vem via /auth/callback do email)
 * - Se usuário abriu direto sem link, redireciona pra /recuperar-senha
 */
export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/recuperar-senha");
  }

  return (
    <div className="relative min-h-dvh overflow-hidden flex flex-col bg-[var(--bg-0)] px-7 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, #2a1810 0%, #0a0706 60%)",
        }}
      />
      <div
        aria-hidden
        className="starry pointer-events-none absolute inset-0 opacity-20"
      />

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col gap-6 fade-up mt-10">
        <div className="text-center">
          <div
            className="mono mb-3"
            style={{
              fontSize: 10,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "var(--gold-400)",
            }}
          >
            Definir nova senha
          </div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Escolha uma senha nova
          </h1>
          <p
            className="mt-2"
            style={{ fontSize: 13, color: "var(--text-2)" }}
          >
            Entrando como <b style={{ color: "var(--text-0)" }}>{user.email}</b>
          </p>
        </div>

        <RedefinirForm />
      </div>
    </div>
  );
}
