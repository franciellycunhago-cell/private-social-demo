import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import {
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  keyUri,
} from "@/lib/admin-totp/server";
import { SetupForm } from "./setup-form";

export const metadata = {
  title: "Configurar 2FA — Admin",
};

/* ====================================================================
 * /admin/2fa/setup
 *
 * Setup de TOTP pra admin que ainda não configurou. Gera secret +
 * QR code + recovery codes em renderização do server. Mostra QR
 * pra escanear no app, lista os recovery codes pra anotar, e form
 * pede confirmação do primeiro código de 6 dígitos.
 *
 * Os recovery codes em texto SÓ são mostrados aqui — depois ficam
 * só hash no banco. Admin precisa anotar.
 * ================================================================== */

export default async function Admin2faSetupPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome_exibicao")
    .eq("id", user.id)
    .maybeSingle();

  const secret = generateSecret();
  const label = user.email || profile?.nome_exibicao || "admin";
  const uri = keyUri(secret, label);
  const qrDataUri = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 240,
    color: { dark: "#1a0f05", light: "#f5e3c4" },
  });

  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = recoveryCodes.map(hashRecoveryCode);

  return (
    <div className="flex flex-col items-center" style={{ paddingTop: 16 }}>
      <div
        className="card flex flex-col gap-5 w-full"
        style={{ maxWidth: 460, padding: 28 }}
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
            Ativar 2FA
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
              maxWidth: 360,
            }}
          >
            Como admin, você precisa proteger sua conta com um segundo
            fator. Vai levar 1 minuto.
          </p>
        </div>

        <ol
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.7,
            paddingLeft: 22,
            margin: 0,
          }}
        >
          <li>
            Instale um app autenticador no celular:{" "}
            <b>Google Authenticator</b>, <b>Authy</b>, <b>1Password</b> etc.
          </li>
          <li>
            Abra o app e escolha &quot;Adicionar conta&quot; →{" "}
            <b>Escanear QR code</b>.
          </li>
          <li>Aponta o celular pro QR abaixo.</li>
          <li>Anote os códigos de recuperação num lugar seguro.</li>
          <li>Digita o código de 6 dígitos que apareceu no app.</li>
        </ol>

        <div
          className="flex justify-center"
          style={{
            background: "#f5e3c4",
            borderRadius: 14,
            padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUri}
            alt="QR code TOTP"
            width={240}
            height={240}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Não consegue escanear? Cole esse secret no app:
          </div>
          <div
            className="mono"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              letterSpacing: 1,
              color: "var(--gold-300)",
              wordBreak: "break-all",
            }}
          >
            {secret}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--rose-400)",
              fontWeight: 700,
            }}
          >
            Códigos de recuperação · ANOTE AGORA (você não vai ver de novo)
          </div>
          <div
            className="mono grid grid-cols-2 gap-1.5"
            style={{
              background: "var(--bg-2)",
              border: "1px solid rgba(217,138,114,0.3)",
              borderRadius: 10,
              padding: 12,
              fontSize: 12,
              letterSpacing: 1,
              color: "var(--text-1)",
            }}
          >
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              lineHeight: 1.5,
            }}
          >
            Cada código serve <b>uma vez só</b> caso você perca acesso ao
            app. Salve em gerenciador de senha ou imprima.
          </div>
        </div>

        <SetupForm secret={secret} recoveryHashes={recoveryHashes} />
      </div>
    </div>
  );
}
