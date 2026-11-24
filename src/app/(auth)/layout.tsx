import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden flex flex-col bg-[var(--bg-0)] px-7 py-8">
      {/* Radial warmth */}
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
        className="pointer-events-none absolute rounded-full blur-[70px]"
        style={{
          top: "-10%",
          left: "-20%",
          width: 360,
          height: 360,
          background:
            "radial-gradient(circle, rgba(228,200,154,0.22), transparent 70%)",
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
            "radial-gradient(circle, rgba(212,175,110,0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="starry pointer-events-none absolute inset-0 opacity-15"
      />

      {/* Header com logo */}
      <div className="relative z-10 flex flex-col items-center gap-3 pt-6">
        <Link href="/" aria-label="Voltar">
          <Image
            src="/logo-full.png"
            alt="PrivateSocial"
            width={72}
            height={72}
            className="object-contain"
          />
        </Link>
        <div
          className="display"
          style={{
            fontSize: 10,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "var(--gold-400)",
            fontWeight: 500,
          }}
        >
          PrivateSocial
        </div>
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-8">
        {children}
      </div>
    </div>
  );
}
