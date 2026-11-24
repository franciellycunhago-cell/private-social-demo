import Image from "next/image";
import Link from "next/link";

export default function SplashPage() {
  return (
    <div className="relative h-dvh min-h-dvh overflow-hidden flex flex-col bg-[var(--bg-0)] px-7 pt-[72px] pb-10">
      {/* Radial warmth de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, #2a1810 0%, #0a0706 60%)",
        }}
      />

      {/* Gold blur accents (posicionados longe do logo) */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[60px]"
        style={{
          top: "8%",
          left: "-10%",
          width: 220,
          height: 220,
          background:
            "radial-gradient(circle, rgba(228,200,154,0.35), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[55px]"
        style={{
          top: "5%",
          right: "-12%",
          width: 200,
          height: 200,
          background:
            "radial-gradient(circle, rgba(212,175,110,0.3), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[70px]"
        style={{
          top: "42%",
          left: "-18%",
          width: 260,
          height: 260,
          background:
            "radial-gradient(circle, rgba(228,200,154,0.28), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[65px]"
        style={{
          top: "48%",
          right: "-15%",
          width: 240,
          height: 240,
          background:
            "radial-gradient(circle, rgba(212,175,110,0.25), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-full blur-[50px]"
        style={{
          bottom: "-8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 360,
          height: 200,
          background:
            "radial-gradient(ellipse, rgba(228,200,154,0.22), transparent 70%)",
        }}
      />

      {/* Starfield sutil */}
      <div
        aria-hidden
        className="starry pointer-events-none absolute inset-0 opacity-20"
      />

      {/* Moldura dourada ornamental (2 camadas) */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[28px]"
        style={{
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          border: "1px solid rgba(228,200,154,0.14)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-[24px]"
        style={{
          top: 26,
          left: 26,
          right: 26,
          bottom: 26,
          border: "1px solid rgba(228,200,154,0.07)",
        }}
      />

      {/* Centro — logo + wordmark */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-[14px]">
        <Image
          src="/logo-full.png"
          alt="PrivateSocial"
          width={140}
          height={140}
          priority
          className="object-contain"
        />

        <div
          className="mt-1.5 flex items-center justify-center gap-2.5"
          style={{ color: "var(--gold-400)" }}
        >
          <span
            className="block h-px"
            style={{
              width: 36,
              background:
                "linear-gradient(to right, transparent, var(--gold-500))",
            }}
          />
          <span
            className="display"
            style={{
              fontSize: 10,
              letterSpacing: 5,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Bem-vindo ao
          </span>
          <span
            className="block h-px"
            style={{
              width: 36,
              background:
                "linear-gradient(to left, transparent, var(--gold-500))",
            }}
          />
        </div>

        <div
          className="display shimmer text-center"
          style={{
            fontSize: 72,
            lineHeight: 0.95,
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          Admin&apos;s
          <br />
          Club
        </div>

        <div
          className="mt-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 19,
            color: "var(--gold-300)",
            fontStyle: "italic",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          Private Circle
        </div>
      </div>

      {/* Bottom — CTA */}
      <div className="relative z-10 w-full">
        <Link
          href="/cadastro"
          className="btn-gold block w-full text-center"
          style={{ padding: "16px", fontSize: 14 }}
        >
          Entrar no Círculo
        </Link>
        <div
          className="text-center mt-4"
          style={{ fontSize: 12, color: "var(--text-2)" }}
        >
          Já tem conta?{" "}
          <Link
            href="/login"
            style={{ color: "var(--gold-300)", fontWeight: 600 }}
          >
            Faça login
          </Link>
        </div>
        <div
          className="mt-5 flex items-center justify-center gap-2.5 text-center mono"
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
