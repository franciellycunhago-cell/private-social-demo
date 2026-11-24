import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ConviteForm } from "./convite-form";

export const metadata: Metadata = {
  title: "Solicite seu Convite — PrivateSocial",
  description:
    "O PrivateSocial é um círculo exclusivo e curado. Solicite seu convite e faça parte da Private Circle.",
};

function IconChat() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-400)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-400)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconCrown() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-400)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 19h20M4 19l1.5-9 4.5 4.5L12 5l2 9.5L18.5 10 20 19" />
    </svg>
  );
}

const steps = [
  {
    Icon: IconChat,
    label: "Preencha seus dados abaixo e toque pra abrir o WhatsApp do suporte",
  },
  {
    Icon: IconCamera,
    label: "Se apresente: diga seu nome e envie uma foto",
  },
  {
    Icon: IconCrown,
    label: "Aguarde — nossa equipe avalia cada solicitação pessoalmente",
  },
];

export default function ConvitePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden flex flex-col items-center bg-[var(--bg-0)] px-7 pt-10 pb-12">
      {/* Radial warmth — mais sutil, fundo mais escuro */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 20%, #140d08 0%, #050302 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[70px]"
        style={{
          top: "-10%",
          left: "-20%",
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, rgba(228,200,154,0.10), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[70px]"
        style={{
          bottom: "-15%",
          right: "-20%",
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, rgba(212,175,110,0.08), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="starry pointer-events-none absolute inset-0 opacity-15"
      />

      {/* Moldura dourada */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[28px]"
        style={{
          top: 16,
          left: 16,
          right: 16,
          bottom: 16,
          border: "1px solid rgba(228,200,154,0.10)",
        }}
      />

      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo topo */}
        <Link href="/" aria-label="PrivateSocial">
          <Image
            src="/logo-full.png"
            alt="PrivateSocial"
            width={88}
            height={88}
            className="object-contain"
          />
        </Link>
        <div
          className="display mt-3"
          style={{
            fontSize: 12,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "var(--gold-400)",
            fontWeight: 500,
          }}
        >
          Private Circle
        </div>

        {/* Hero — envelope */}
        <div className="mt-7 w-full">
          <Image
            src="/convite-envelope.webp"
            alt="Solicite seu Convite — PrivateSocial"
            width={480}
            height={566}
            priority
            className="w-full h-auto"
          />
        </div>

        {/* Texto intro */}
        <p
          className="mt-5 text-center"
          style={{
            fontSize: 18,
            color: "var(--text-1)",
            lineHeight: 1.75,
          }}
        >
          O PrivateSocial é um círculo fechado e curado para casais e
          singles do meio liberal. A entrada é criteriosa — nossa equipe
          conhece cada membro antes de liberar o acesso.
        </p>

        {/* Divisor */}
        <div className="mt-8 flex items-center gap-3 w-full">
          <span
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(212,175,110,0.25))",
            }}
          />
          <span
            className="display"
            style={{
              fontSize: 13,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "var(--gold-400)",
            }}
          >
            Como funciona
          </span>
          <span
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(to left, transparent, rgba(212,175,110,0.25))",
            }}
          />
        </div>

        {/* Passos */}
        <div className="mt-5 w-full flex flex-col gap-5">
          {steps.map(({ Icon, label }, i) => (
            <div key={i} className="flex items-start gap-4">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-full"
                style={{
                  width: 42,
                  height: 42,
                  background: "rgba(212,175,110,0.07)",
                  border: "1px solid rgba(212,175,110,0.20)",
                }}
              >
                <Icon />
              </div>
              <p
                className="flex-1 pt-2.5"
                style={{
                  fontSize: 16,
                  color: "var(--text-1)",
                  lineHeight: 1.55,
                }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA — form com nome + tipo obrigatórios antes do WhatsApp */}
        <div className="mt-9 w-full">
          <ConviteForm />
        </div>

        {/* Footer badges */}
        <div
          className="mt-10 flex items-center justify-center gap-2.5 mono"
          style={{
            fontSize: 9,
            color: "var(--text-3)",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          <span>+18</span>
          <span style={{ color: "var(--gold-600)" }}>◆</span>
          <span>Verificado</span>
          <span style={{ color: "var(--gold-600)" }}>◆</span>
          <span>Discreto</span>
        </div>
      </div>
    </div>
  );
}
