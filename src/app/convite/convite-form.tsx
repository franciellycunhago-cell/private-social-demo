"use client";

import { useMemo, useState } from "react";

/* ====================================================================
 * ConviteForm — formulário pré-WhatsApp do /convite.
 *
 * Coleta nome e tipo (solteiro/solteira/casal) ANTES de redirecionar
 * pro WhatsApp do Admin. A mensagem que vai pro WhatsApp já chega
 * preenchida com os dados — assim o suporte não precisa puxar conversa
 * pra saber quem está pedindo.
 *
 * Decisão UX 18/05: botão fica desabilitado até nome ter pelo menos
 * 2 caracteres E um tipo estar selecionado. Sem bypass — não dá pra
 * pular o form.
 * ================================================================== */

const WHATSAPP_BASE = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}`;

type Tipo = "casal" | "mulher" | "homem";

// Termo "single" preferido pelo cliente em vez de "solo"
const TIPOS: Array<{ value: Tipo; label: string; emoji: string }> = [
  { value: "mulher", label: "Mulher single", emoji: "♀" },
  { value: "homem", label: "Homem single", emoji: "♂" },
  { value: "casal", label: "Casal", emoji: "♥" },
];

function IconSend() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22,2 15,22 11,13 2,9" />
    </svg>
  );
}

export function ConviteForm() {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Tipo | null>(null);

  const nomeOk = nome.trim().length >= 2;
  const podeEnviar = nomeOk && tipo !== null;

  const whatsappUrl = useMemo(() => {
    if (!podeEnviar || !tipo) return "";
    const tipoLabel = TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
    const texto =
      `Olá! Vim pelo site e gostaria de solicitar meu convite pro PrivateSocial 👑\n\n` +
      `Nome: ${nome.trim()}\n` +
      `Tipo: ${tipoLabel}`;
    return `${WHATSAPP_BASE}?text=${encodeURIComponent(texto)}`;
  }, [nome, tipo, podeEnviar]);

  // Labels dinâmicos pro placeholder do nome — casal pede "nome do casal"
  const nomePlaceholder =
    tipo === "casal"
      ? "Ex: Ana e João"
      : "Seu nome";

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Tipo — chips selecionáveis */}
      <div className="flex flex-col gap-2">
        <label
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--gold-400)",
            fontWeight: 500,
          }}
        >
          Você é
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => {
            const active = tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                aria-pressed={active}
                style={{
                  padding: "12px 8px",
                  borderRadius: 12,
                  background: active
                    ? "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))"
                    : "rgba(255,255,255,0.02)",
                  border: active
                    ? "1px solid var(--gold-400)"
                    : "1px solid rgba(212,175,110,0.18)",
                  color: active ? "var(--gold-300)" : "var(--text-2)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "background 0.15s, border 0.15s, color 0.15s",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden>
                  {t.emoji}
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nome */}
      <div className="flex flex-col gap-2">
        <label
          className="mono"
          htmlFor="convite-nome"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--gold-400)",
            fontWeight: 500,
          }}
        >
          {tipo === "casal" ? "Nome do casal" : "Seu nome"}
        </label>
        <input
          id="convite-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={nomePlaceholder}
          maxLength={60}
          autoComplete="name"
          style={{
            padding: "13px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(212,175,110,0.20)",
            color: "var(--text-0)",
            fontSize: 15,
            fontFamily: "var(--font-ui)",
            outline: "none",
            transition: "border 0.15s, background 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid var(--gold-400)";
            e.currentTarget.style.background = "rgba(212,175,110,0.04)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid rgba(212,175,110,0.20)";
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        />
      </div>

      {/* CTA — só vira link real quando preenchido */}
      {podeEnviar ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold mt-4 flex items-center justify-center gap-3 w-full"
          style={{ padding: "17px", fontSize: 15 }}
        >
          <IconSend />
          Solicitar meu convite
        </a>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="mt-4 flex items-center justify-center gap-3 w-full"
          style={{
            padding: "17px",
            fontSize: 15,
            borderRadius: 999,
            background: "rgba(212,175,110,0.10)",
            border: "1px solid rgba(212,175,110,0.20)",
            color: "rgba(228,200,154,0.45)",
            cursor: "not-allowed",
            fontWeight: 500,
            letterSpacing: 0.3,
          }}
        >
          <IconSend />
          {!tipo
            ? "Selecione casal ou single"
            : !nomeOk
              ? "Preencha seu nome"
              : "Solicitar meu convite"}
        </button>
      )}

      <p
        className="text-center"
        style={{
          fontSize: 13,
          color: "var(--text-3)",
          lineHeight: 1.5,
          marginTop: 2,
        }}
      >
        Você será redirecionado para o WhatsApp do suporte
      </p>
    </div>
  );
}
