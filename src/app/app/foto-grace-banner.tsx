import Link from "next/link";
import { MIN_FOTOS } from "@/lib/foto-grace";

/* ====================================================================
 * FotoGraceBanner — banner discreto que aparece em todas as telas do
 * /app quando o user está em período de cortesia (ainda não postou
 * o mínimo de fotos públicas).
 *
 * Server component — sem interatividade, só leitura do status.
 * ================================================================== */

export function FotoGraceBanner({
  diasRestantes,
  fotosFaltam,
  fotosCount,
}: {
  diasRestantes: number;
  fotosFaltam: number;
  fotosCount: number;
}) {
  // Lógica de texto: 0 dias = "hoje é o último dia", 1 dia = "amanhã",
  // 2+ = "em X dias".
  const prazo =
    diasRestantes === 0
      ? "Último dia"
      : diasRestantes === 1
        ? "Falta 1 dia"
        : `Faltam ${diasRestantes} dias`;

  const fotosTxt =
    fotosFaltam === 1
      ? "mais 1 foto"
      : `mais ${fotosFaltam} fotos`;

  const urgente = diasRestantes <= 1;

  return (
    <div className="px-5 pt-3">
      <Link
        href="/app/perfil/fotos"
        className="flex items-center gap-3 rounded-2xl"
        style={{
          padding: "10px 14px",
          background: urgente
            ? "linear-gradient(135deg, rgba(217,138,114,0.14), rgba(217,138,114,0.04))"
            : "linear-gradient(135deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
          border: urgente
            ? "1px solid rgba(217,138,114,0.5)"
            : "1px solid var(--gold-600)",
          textDecoration: "none",
          color: "var(--text-0)",
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>📸</span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: urgente ? "var(--rose-400)" : "var(--gold-300)",
              lineHeight: 1.3,
            }}
          >
            {prazo} pra adicionar {fotosTxt}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {fotosCount} de {MIN_FOTOS} fotos · toque pra adicionar mais
          </div>
        </div>
        <span
          style={{
            color: urgente ? "var(--rose-400)" : "var(--gold-300)",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </Link>
    </div>
  );
}
