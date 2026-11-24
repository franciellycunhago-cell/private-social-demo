import Image from "next/image";

/* ====================================================================
 * PageHeading — título grande com o ícone T-coroa ao lado.
 * Usado no topo de páginas internas (Buscar, Eventos, Conversas etc)
 * pra reforçar a marca PrivateSocial em cada tela.
 * ================================================================== */

export function PageHeading({
  title,
  subtitle,
  iconSize = 56,
}: {
  title: string;
  subtitle?: string;
  iconSize?: number;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <Image
          src="/icone.png"
          alt=""
          width={iconSize * 2}
          height={iconSize * 2}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            filter: "drop-shadow(0 6px 18px rgba(212,175,110,0.45))",
            flexShrink: 0,
          }}
          priority
        />
        <h1
          className="display"
          style={{
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
      {subtitle && (
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
