import Link from "next/link";
import { CadastroForm } from "./form";
import { InstallAppButton } from "../install-app-button";

export const metadata = {
  title: "Criar acesso — PrivateSocial",
};

type SearchParams = Promise<{ convite?: string }>;

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { convite } = await searchParams;
  const codigoConvite = (convite ?? "").trim().toUpperCase();

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6 fade-up">
      <div className="text-center">
        <h1
          className="display"
          style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Entre no Círculo
        </h1>
        <p
          className="mt-2"
          style={{ fontSize: 14, color: "var(--text-2)" }}
        >
          Cadastro reservado, verificado pelo Admin
        </p>
      </div>

      {codigoConvite && (
        <div
          className="rounded-xl text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.02))",
            border: "1px solid var(--gold-500)",
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--gold-300)",
            lineHeight: 1.5,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            Convite recebido
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14,
              letterSpacing: 1.5,
              fontWeight: 700,
              color: "var(--gold-300)",
            }}
          >
            {codigoConvite}
          </div>
        </div>
      )}

      <InstallAppButton />

      <CadastroForm convite={codigoConvite || undefined} />

      <div
        className="text-center"
        style={{ fontSize: 13, color: "var(--text-2)" }}
      >
        Já tem conta?{" "}
        <Link
          href="/login"
          style={{ color: "var(--gold-300)", fontWeight: 600 }}
        >
          Fazer login
        </Link>
      </div>

      <p
        className="text-center mono mt-2"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        +18 · Verificado · Discreto
      </p>
    </div>
  );
}
