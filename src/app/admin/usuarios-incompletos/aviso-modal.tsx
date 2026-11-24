"use client";

import { useEffect, useState, useTransition } from "react";
import { enviarAvisoAdmin } from "@/lib/admin/actions";

/* ====================================================================
 * AvisoModal — modal pra enviar notificação admin com mensagem custom.
 *
 * Templates rápidos:
 *  - 📸 Lembrete fotos (mensagem padrão)
 *  - ⏰ Aviso 5 dias suspensão
 *  - 🚨 Última chance 24h
 *
 * Admin pode escolher template ou escrever do zero. Funciona pra 1 ou
 * N destinatários — mesma action.
 * ================================================================== */

const TEMPLATES = [
  {
    id: "fotos",
    label: "📸 Lembrete fotos",
    mensagem:
      "Complete seu perfil — adicione mais fotos pra liberar tudo no app.",
  },
  {
    id: "5dias",
    label: "⏰ 5 dias pra suspensão",
    mensagem:
      "Sua conta será bloqueada em 5 dias se você não completar 3 fotos públicas. Toque pra adicionar agora.",
  },
  {
    id: "24h",
    label: "🚨 Última chance: 24h",
    mensagem:
      "Última chance — você tem 24h pra completar 3 fotos antes do bloqueio. Toque pra adicionar agora.",
  },
];

const MAX_LEN = 500;

export function AvisoModal({
  open,
  onClose,
  targetIds,
}: {
  open: boolean;
  onClose: () => void;
  targetIds: string[];
}) {
  const [mensagem, setMensagem] = useState(TEMPLATES[0]!.mensagem);
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<
    | { tipo: "sucesso"; texto: string }
    | { tipo: "erro"; texto: string }
    | null
  >(null);

  // Reset state quando o modal abre
  useEffect(() => {
    if (open) {
      setMensagem(TEMPLATES[0]!.mensagem);
      setTemplateId(TEMPLATES[0]!.id);
      setResultado(null);
    }
  }, [open]);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const n = targetIds.length;
  const headerText =
    n === 1 ? "Enviar aviso pra 1 pessoa" : `Enviar aviso pra ${n} pessoas`;

  function selecionarTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setMensagem(t.mensagem);
  }

  function onSubmit() {
    if (pending) return;
    const msg = mensagem.trim();
    if (!msg) {
      setResultado({ tipo: "erro", texto: "Mensagem não pode estar vazia." });
      return;
    }
    setResultado(null);
    startTransition(async () => {
      const r = await enviarAvisoAdmin(targetIds, msg);
      if ("error" in r) {
        setResultado({ tipo: "erro", texto: r.error });
        return;
      }
      const fail = r.falharam > 0 ? ` (${r.falharam} push falharam)` : "";
      setResultado({
        tipo: "sucesso",
        texto: `${r.enviados} aviso${r.enviados === 1 ? "" : "s"} enviado${r.enviados === 1 ? "" : "s"}${fail}.`,
      });
      // Fecha o modal automaticamente depois de 1.5s
      setTimeout(() => onClose(), 1500);
    });
  }

  const restantes = MAX_LEN - mensagem.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: "100%",
          background: "var(--bg-1)",
          border: "1px solid var(--gold-600)",
          borderRadius: 18,
          padding: 22,
          color: "var(--text-0)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div
            className="display"
            style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            {headerText}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-3)",
              fontSize: 22,
              cursor: pending ? "default" : "pointer",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Notificação in-app (sininho) + push notification. Escolha um
          template ou personalize a mensagem.
        </div>

        {/* Templates */}
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 8,
          }}
        >
          Templates rápidos
        </div>
        <div
          className="flex gap-2 flex-wrap"
          style={{ marginBottom: 16 }}
        >
          {TEMPLATES.map((t) => {
            const ativo = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selecionarTemplate(t.id)}
                disabled={pending}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: ativo
                    ? "linear-gradient(135deg, rgba(212,175,110,0.25), rgba(212,175,110,0.08))"
                    : "rgba(255,255,255,0.03)",
                  border: ativo
                    ? "1px solid var(--gold-400)"
                    : "1px solid var(--line)",
                  color: ativo ? "var(--gold-100)" : "var(--text-1)",
                  cursor: pending ? "default" : "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Textarea editável */}
        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 6,
          }}
        >
          Mensagem
        </div>
        <textarea
          value={mensagem}
          onChange={(e) => {
            setMensagem(e.target.value);
            // Se editou, deseleciona template (visual)
            const t = TEMPLATES.find((x) => x.mensagem === e.target.value);
            setTemplateId(t?.id ?? "custom");
          }}
          disabled={pending}
          rows={4}
          maxLength={MAX_LEN}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            color: "var(--text-0)",
            fontSize: 14,
            fontFamily: "var(--font-ui)",
            resize: "vertical",
            minHeight: 90,
            outline: "none",
            lineHeight: 1.5,
          }}
        />
        <div
          className="mono flex justify-end"
          style={{
            fontSize: 10,
            letterSpacing: 0.5,
            color: restantes < 50 ? "var(--rose-400)" : "var(--text-3)",
            marginTop: 4,
          }}
        >
          {restantes} caracteres restantes
        </div>

        {/* Resultado */}
        {resultado && (
          <div
            role="status"
            style={{
              fontSize: 12,
              padding: "10px 14px",
              borderRadius: 10,
              marginTop: 12,
              background:
                resultado.tipo === "sucesso"
                  ? "rgba(154,197,121,0.12)"
                  : "rgba(217,138,114,0.12)",
              border:
                resultado.tipo === "sucesso"
                  ? "1px solid rgba(154,197,121,0.4)"
                  : "1px solid rgba(217,138,114,0.4)",
              color:
                resultado.tipo === "sucesso"
                  ? "#9ac579"
                  : "var(--rose-400)",
              lineHeight: 1.4,
            }}
          >
            {resultado.tipo === "sucesso" ? "✓ " : "⚠ "}
            {resultado.texto}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2" style={{ marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-1)",
              fontSize: 13,
              fontWeight: 500,
              cursor: pending ? "default" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || mensagem.trim().length === 0}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              background: "var(--shine-gold)",
              color: "#1a0f05",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor:
                pending || mensagem.trim().length === 0
                  ? "default"
                  : "pointer",
              opacity:
                pending || mensagem.trim().length === 0 ? 0.6 : 1,
              minWidth: 120,
            }}
          >
            {pending ? "Enviando…" : `Enviar (${n})`}
          </button>
        </div>
      </div>
    </div>
  );
}
