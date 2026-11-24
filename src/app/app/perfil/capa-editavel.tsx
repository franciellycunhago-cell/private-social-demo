"use client";

import { useState } from "react";
import Image from "next/image";
import { EditarCapaModal } from "./editar-capa-modal";

/* ====================================================================
 * CapaEditavel — wrapper client da capa do perfil próprio com o lápis.
 * Renderiza a foto e o ícone que abre o modal de edição.
 * ================================================================== */

export function CapaEditavel({
  capaUrl,
  nome,
  opcoes,
  capaAtualPath,
  size = 220,
}: {
  capaUrl: string | null;
  nome: string;
  opcoes: { path: string; src: string }[];
  capaAtualPath: string | null;
  /** Tamanho do avatar em px. Default 220 (perfil), use menor em outros lugares. */
  size?: number;
}) {
  const [aberto, setAberto] = useState(false);

  const semFoto = !capaUrl;

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label={semFoto ? "Adicionar foto de perfil" : "Trocar foto de perfil"}
          className="relative overflow-hidden block"
          style={{
            width: size,
            height: size,
            borderRadius: size > 140 ? 28 : 20,
            border: "2px solid var(--gold-500)",
            background: "var(--bg-1)",
            boxShadow:
              "0 0 0 5px rgba(212,175,110,0.08), 0 0 32px rgba(212,175,110,0.28), 0 20px 50px rgba(0,0,0,0.55)",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {capaUrl ? (
            <Image
              src={capaUrl}
              alt={nome}
              fill
              sizes={`${size}px`}
              priority
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(212,175,110,0.25), transparent 60%), linear-gradient(145deg, #2a1810, #0a0706)",
                color: "var(--gold-400)",
              }}
            >
              <span style={{ fontSize: size > 140 ? 48 : 32 }}>＋</span>
            </div>
          )}

          {/* Ícone de lápis no canto inferior direito */}
          <span
            aria-hidden
            className="absolute flex items-center justify-center"
            style={{
              bottom: 10,
              right: 10,
              width: size > 140 ? 38 : 30,
              height: size > 140 ? 38 : 30,
              borderRadius: "50%",
              background: "var(--shine-gold)",
              border: "2px solid var(--bg-0)",
              color: "#1a0f05",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              zIndex: 2,
            }}
          >
            <PencilSmall />
          </span>
        </button>

        {/* Texto de ajuda abaixo da capa */}
        <div
          className="mono text-center"
          style={{
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: semFoto ? "var(--gold-300)" : "var(--text-3)",
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {semFoto
            ? "✦ Adicione uma foto de perfil"
            : "Toque pra trocar a foto"}
        </div>
      </div>

      <EditarCapaModal
        open={aberto}
        onClose={() => setAberto(false)}
        opcoes={opcoes}
        capaAtualPath={capaAtualPath}
      />
    </>
  );
}

function PencilSmall() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
