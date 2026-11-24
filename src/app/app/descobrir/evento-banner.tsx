"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ====================================================================
 * EventoBanner — banner rotativo no topo do Descobrir.
 *
 *  - Rota automática entre até 3 próximos eventos a cada 5s
 *  - Toca pra abrir /app/eventos
 *  - Indicador dos steps (bolinhas no rodapé)
 * ================================================================== */

export type EventoBannerItem = {
  id: string;
  titulo: string;
  dataFmt: string;
  cidade: string | null;
  capa: string | null;
  vipOnly: boolean;
};

const INTERVALO_MS = 5000;

export function EventoBanner({ items }: { items: EventoBannerItem[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIdx((cur) => (cur + 1) % items.length);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const evento = items[idx]!;

  return (
    <div className="relative z-10 px-5 pb-3">
      <Link
        href="/app/eventos"
        className="relative block rounded-2xl overflow-hidden"
        style={{
          height: 92,
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          textDecoration: "none",
        }}
        aria-label={`Ver eventos — destaque: ${evento.titulo}`}
      >
        {evento.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={evento.capa}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 20% 40%, rgba(212,175,110,0.3), transparent 60%), linear-gradient(135deg, #2a1810 0%, #0a0706 70%)",
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,7,6,0.88) 40%, rgba(10,7,6,0.2) 100%)",
          }}
        />
        <div
          className="absolute inset-0 flex items-center gap-3 px-4"
          style={{ color: "#fff" }}
        >
          <div className="min-w-0 flex-1">
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--gold-300)",
                marginBottom: 2,
              }}
            >
              {evento.vipOnly ? "Evento VIP · " : ""}
              {evento.dataFmt}
            </div>
            <div
              className="display truncate"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-0)",
                lineHeight: 1.2,
              }}
            >
              {evento.titulo}
            </div>
            {evento.cidade && (
              <div
                className="truncate"
                style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}
              >
                {evento.cidade}
              </div>
            )}
          </div>
          <span
            className="mono flex-shrink-0"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--gold-300)",
            }}
          >
            Ver →
          </span>
        </div>
      </Link>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {items.map((_, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                width: i === idx ? 14 : 4,
                height: 4,
                borderRadius: 2,
                background:
                  i === idx ? "var(--gold-400)" : "rgba(255,255,255,0.18)",
                transition: "width 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
