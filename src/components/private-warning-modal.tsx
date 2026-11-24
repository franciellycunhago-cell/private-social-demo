"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const STORAGE_KEY = "privatesocial:privadas-aceite-v1";

/* ====================================================================
 * PrivateWarningModal — aviso 1ª vez sobre captura de fotos privadas.
 *
 * Renderiza um modal client quando `armed=true` (ex: usuário entrou na
 * tab "Privado") E ainda não aceitou. Aceitação fica em localStorage
 * por device — limpou cache, vê de novo (aceitável).
 *
 *  - Aceito → fecha e chama onAccept (pra page registrar visualmente)
 *  - Recusado → fecha e chama onDeny (pra page voltar pra outra tab)
 * ================================================================== */

export function PrivateWarningModal({
  armed,
  onAccept,
  onDeny,
}: {
  armed: boolean;
  onAccept?: () => void;
  onDeny?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!armed) return;
    try {
      const aceito = localStorage.getItem(STORAGE_KEY) === "1";
      if (!aceito) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [armed]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  function aceitar() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage bloqueado — modal volta a aparecer na próxima */
    }
    setOpen(false);
    onAccept?.();
  }

  function recusar() {
    setOpen(false);
    onDeny?.();
  }

  const content = (
    <div
      onClick={recusar}
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
          border: "1px solid var(--gold-500)",
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
          <div style={{ fontSize: 36 }}>🔒</div>
          <div
            className="display gold-text"
            style={{ fontSize: 20, fontWeight: 500 }}
          >
            Acesso a fotos privadas
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--text-1)",
            lineHeight: 1.55,
          }}
        >
          As fotos privadas são compartilhadas em **confiança** entre membros
          verificados. Antes de continuar, entenda:
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
            Cada foto carrega <b>sua marca d&apos;água</b> com seu @handle —
            se vazar, dá pra rastrear.
          </li>
          <li>
            <b>Capturar e compartilhar</b> fotos privadas viola o termo de uso e
            pode resultar em <b>banimento permanente</b> e ações legais.
          </li>
          <li>
            Print/screenshot não é tecnicamente bloqueado em web —{" "}
            <b>respeito mútuo é o que sustenta a comunidade.</b>
          </li>
        </ul>

        <Link
          href="/termos"
          target="_blank"
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "var(--gold-300)",
            textDecoration: "underline",
            textAlign: "center",
          }}
        >
          Ler termo de uso completo ↗
        </Link>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={recusar}
            className="btn-ghost flex-1"
            style={{ padding: 12 }}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={aceitar}
            className="btn-gold flex-1"
            style={{ padding: 12 }}
          >
            Concordo e respeito
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
