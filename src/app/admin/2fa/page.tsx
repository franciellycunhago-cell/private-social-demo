import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminTotpState } from "@/lib/admin-totp/server";
import { TotpVerifyForm } from "./verify-form";

export const metadata = {
  title: "Verificação 2FA — Admin",
};

/* ====================================================================
 * /admin/2fa
 *
 * Tela cobrada pelo layout admin quando o admin tem TOTP ativo
 * mas a sessão TOTP expirou (>8h sem verificar). Form pede o
 * código atual de 6 dígitos do app authenticator.
 *
 * Tem opção secundária pra usar código de recuperação se perdeu
 * acesso ao app.
 * ================================================================== */

export default async function Admin2faPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/app");

  const totp = await getAdminTotpState(user.id);
  if (totp.state === "nao_configurado") {
    redirect("/admin/2fa/setup");
  }
  if (totp.verificadoRecente) {
    redirect("/admin/moderacao");
  }

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "70dvh" }}>
      <div
        className="card flex flex-col gap-5 w-full"
        style={{ maxWidth: 400, padding: 28 }}
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div style={{ fontSize: 36 }}>🔐</div>
          <h1
            className="display"
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Verificação em 2 fatores
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            Abra seu app autenticador (Google Authenticator, Authy etc.)
            e digita o código atual de 6 dígitos.
          </p>
        </div>

        <TotpVerifyForm />
      </div>
    </div>
  );
}
