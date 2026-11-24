"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { excluirMinhaConta } from "./actions";

/* ====================================================================
 * DeleteAccountButton — botão "Excluir conta" no menu do perfil.
 *
 * Abre modal de confirmação 2 etapas: (1) info do que acontece +
 * checkbox "estou ciente"; (2) digitar EXCLUIR pra confirmar.
 * Ao confirmar, chama excluirMinhaConta e redireciona pra /excluido.
 * ================================================================== */

export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (typeof window !== "undefined" && !mounted) {
    setTimeout(() => setMounted(true), 0);
  }

  function reset() {
    setOpen(false);
    setAceito(false);
    setConfirma("");
    setError(null);
  }

  function handleExcluir() {
    if (confirma.trim().toUpperCase() !== "EXCLUIR") {
      setError("Digite EXCLUIR pra confirmar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await excluirMinhaConta();
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push("/excluido");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 py-3"
        style={{
          borderBottom: "1px solid var(--line)",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "rgba(217,138,114,0.1)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
          }}
        >
          🗑
        </span>
        <div
          className="flex-1"
          style={{ fontSize: 14, color: "var(--rose-400)" }}
        >
          Excluir conta
        </div>
        <span style={{ color: "var(--text-3)", fontSize: 11 }}>LGPD</span>
        <span style={{ color: "var(--text-3)", fontSize: 16 }}>›</span>
      </button>

      {open && mounted && createPortal(
        <div
          onClick={reset}
          className="fixed inset-0 flex items-end sm:items-center justify-center"
          style={{ zIndex: 99999, background: "rgba(0,0,0,0.78)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md flex flex-col"
            style={{
              background: "var(--bg-1)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: "16px 20px calc(env(safe-area-inset-bottom) + 18px)",
              gap: 14,
              border: "1px solid rgba(217,138,114,0.4)",
              maxHeight: "92dvh",
              overflowY: "auto",
            }}
          >
            <div
              className="mx-auto"
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                background: "var(--line-strong)",
              }}
            />

            <div className="flex flex-col items-center text-center gap-2">
              <div style={{ fontSize: 36 }}>🗑</div>
              <div
                className="display"
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  color: "var(--rose-400)",
                }}
              >
                Excluir minha conta
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: "var(--text-1)",
                lineHeight: 1.55,
              }}
            >
              Ao excluir sua conta:
            </div>

            <ul
              style={{
                fontSize: 13,
                color: "var(--text-1)",
                lineHeight: 1.6,
                paddingLeft: 22,
                margin: 0,
              }}
            >
              <li>
                Você sai do app imediatamente. Outros membros não te veem mais.
              </li>
              <li>
                Sua conta entra em <b>período de carência de 7 dias</b>. Nesse
                prazo, é possível reverter por email.
              </li>
              <li>
                Após 7 dias, <b>todos os seus dados são apagados</b> em
                definitivo: perfil, fotos, posts, mensagens, matches e
                stories.
              </li>
              <li>
                Mensagens já enviadas pra outros não são apagadas do
                lado deles (privacidade dos destinatários).
              </li>
            </ul>

            <label
              className="flex items-center gap-2.5"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-0)",
              }}
            >
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => setAceito(e.target.checked)}
                style={{ accentColor: "var(--gold-300)" }}
              />
              <span>Entendi as consequências e quero continuar</span>
            </label>

            {aceito && (
              <div className="flex flex-col gap-2">
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                  }}
                >
                  Pra confirmar, digite EXCLUIR
                </div>
                <input
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value.toUpperCase())}
                  placeholder="EXCLUIR"
                  className="mono"
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: "11px 14px",
                    color: "var(--text-0)",
                    fontSize: 14,
                    letterSpacing: 2,
                    outline: "none",
                  }}
                  autoFocus
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl p-2.5"
                style={{
                  background: "rgba(217,138,114,0.08)",
                  border: "1px solid rgba(217,138,114,0.3)",
                  color: "var(--rose-400)",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="btn-ghost flex-1"
                disabled={pending}
                style={{ padding: 12 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluir}
                disabled={
                  pending ||
                  !aceito ||
                  confirma.trim().toUpperCase() !== "EXCLUIR"
                }
                className="mono flex-1"
                style={{
                  background: "rgba(217,138,114,0.18)",
                  border: "1px solid var(--rose-400)",
                  color: "var(--rose-400)",
                  padding: "12px 14px",
                  borderRadius: 999,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontWeight: 800,
                  cursor:
                    pending ||
                    !aceito ||
                    confirma.trim().toUpperCase() !== "EXCLUIR"
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    pending ||
                    !aceito ||
                    confirma.trim().toUpperCase() !== "EXCLUIR"
                      ? 0.5
                      : 1,
                }}
              >
                {pending ? "Excluindo..." : "Excluir conta"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
