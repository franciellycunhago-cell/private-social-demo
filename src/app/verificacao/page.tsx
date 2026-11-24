import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { signOut } from "../(auth)/actions";
import { SelfieUploader } from "./uploader";

export const metadata = {
  title: "Verificação — PrivateSocial",
};

export default async function VerificacaoPage() {
  const info = await getProfileStatus();
  if (!info) redirect("/login");

  if (info.status.state === "signup") {
    redirect("/onboarding");
  }
  if (info.status.state === "aprovado") {
    redirect("/app");
  }

  const nome = info.status.profile.nome_exibicao ?? info.email ?? "Você";
  const isCasal = info.status.profile.tipo === "casal";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg-0)] px-6 py-10">
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
        className="starry pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-25"
      />

      <div className="relative z-10 max-w-md mx-auto flex flex-col gap-6 fade-up">
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
            Última etapa · Verificação
          </div>
          <h1
            className="display"
            style={{
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {info.status.state === "pendente"
              ? "Admin está revisando"
              : info.status.state === "rejeitado"
              ? "Precisamos de outra foto"
              : "Uma selfie rápida"}
          </h1>
          <p
            className="mt-3"
            style={{
              fontSize: 14,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            {info.status.state === "pendente"
              ? `Olá, ${nome}. Recebemos sua selfie. O Admin revisa pessoalmente cada cadastro.`
              : info.status.state === "rejeitado"
              ? "A foto anterior não pôde ser aprovada. Envie uma nova seguindo as dicas abaixo."
              : "Só pra garantir que você é real. Nunca aparece no seu perfil."}
          </p>
        </div>

        {info.status.state === "pendente" && (
          <div
            className="card p-6 flex flex-col items-center gap-4 text-center"
            style={{
              background:
                "linear-gradient(160deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
            }}
          >
            <HourglassIcon />
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-0)",
                  marginBottom: 4,
                }}
              >
                Aguardando aprovação
              </div>
              <div
                style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}
              >
                Em geral respondemos em até 24h. Você vai receber um email assim
                que sua conta for liberada.
              </div>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-3)",
                paddingTop: 8,
                borderTop: "1px solid var(--line)",
                width: "100%",
              }}
            >
              Enviado em{" "}
              {new Date(info.status.verificacao.created_at).toLocaleString(
                "pt-BR",
                { dateStyle: "short", timeStyle: "short" },
              )}
            </div>
          </div>
        )}

        {info.status.state === "rejeitado" && (
          <div
            className="p-4 rounded-2xl flex flex-col gap-2"
            style={{
              background: "rgba(217, 138, 114, 0.08)",
              border: "1px solid rgba(217, 138, 114, 0.3)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--rose-400)",
              }}
            >
              Motivo da rejeição
            </div>
            <div style={{ fontSize: 13, color: "var(--text-1)" }}>
              {info.status.verificacao.motivo_rejeicao ??
                "Foto não atendeu aos requisitos. Envie uma nova."}
            </div>
          </div>
        )}

        {(info.status.state === "onboarded" ||
          info.status.state === "rejeitado") && (
          <>
            {/* Aviso destacado pra casais — exigência específica pra
                 reduzir fakes (todo mundo posando junto + sinal de
                 confirmação visual) */}
            {isCasal && (
              <div
                className="rounded-2xl p-4 flex gap-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))",
                  border: "1px solid var(--gold-500)",
                  boxShadow: "0 0 24px rgba(212,175,110,0.12)",
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>🤙</span>
                <div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: "var(--gold-300)",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Atenção · Casal
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-1)",
                      lineHeight: 1.55,
                    }}
                  >
                    A foto precisa ter <strong>os dois juntos</strong> e
                    cada um fazendo o sinal de <strong>joia 🤙</strong> com
                    a mão (ou ✌️ paz e amor). Sem isso a verificação é
                    recusada — é como confirmamos que vocês estão na hora
                    e que não é foto roubada.
                  </div>
                </div>
              </div>
            )}

            <div className="card p-5 flex flex-col gap-3">
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Como tirar a {isCasal ? "foto" : "selfie"}
              </div>
              <ul className="flex flex-col gap-2">
                {isCasal ? (
                  <>
                    <Tip>
                      <strong>Os dois</strong> aparecem no enquadramento
                    </Tip>
                    <Tip>
                      <strong>Cada um</strong> com a mão fazendo joia 🤙 ou
                      sinal de paz ✌️
                    </Tip>
                    <Tip>Rosto visível dos dois, sem máscara nem óculos escuros</Tip>
                    <Tip>Boa iluminação, sem filtros</Tip>
                    <Tip>Foto na hora — não vale foto antiga</Tip>
                  </>
                ) : (
                  <>
                    <Tip>Mostre o rosto inteiro, sem óculos escuros ou máscara</Tip>
                    <Tip>Boa iluminação, sem filtros</Tip>
                    <Tip>Foto sua na hora — não vale foto antiga</Tip>
                  </>
                )}
                <Tip>Nunca aparece no seu perfil — só o Admin vê</Tip>
              </ul>
            </div>

            <SelfieUploader />
          </>
        )}

        <form action={signOut}>
          <button type="submit" className="btn-ghost w-full">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li
      className="flex gap-2 items-start"
      style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.4 }}
    >
      <span style={{ color: "var(--gold-400)", flexShrink: 0 }}>◆</span>
      <span>{children}</span>
    </li>
  );
}

function HourglassIcon() {
  return (
    <div
      className="grid place-items-center rounded-full"
      style={{
        width: 88,
        height: 88,
        background:
          "radial-gradient(circle, rgba(212,175,110,0.25), transparent 70%)",
        border: "2px solid var(--gold-500)",
      }}
    >
      <svg
        width={36}
        height={36}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--gold-300)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 2h14v4l-6 6 6 6v4H5v-4l6-6-6-6V2z" />
      </svg>
    </div>
  );
}
