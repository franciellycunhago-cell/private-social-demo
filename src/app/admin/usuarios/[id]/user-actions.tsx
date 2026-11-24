"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  apagarTodosPostsDoUser,
  cancelarExclusaoUsuario,
  darVipCortesia,
  excluirUsuario,
  reativarUsuario,
  resetarSenhaProvisoria,
  revogarVipCortesia,
  suspenderUsuario,
} from "@/lib/admin/actions";
import {
  CORTESIA_PERIODOS_LABEL,
  type CortesiaPeriodo,
} from "@/lib/admin/cortesia";

/* ====================================================================
 * UserActions — barra de ações no mini-perfil admin.
 *  - Suspender (com motivo) / Reativar
 *  - Excluir (soft delete) / Cancelar exclusão
 * ================================================================== */

export function UserActions({
  userId,
  suspenso,
  deletado,
  postsCount,
  isVip,
}: {
  userId: string;
  suspenso: boolean;
  deletado: boolean;
  postsCount: number;
  isVip: boolean;
}) {
  const router = useRouter();
  const [showSuspender, setShowSuspender] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showCortesia, setShowCortesia] = useState(false);
  const [periodoCortesia, setPeriodoCortesia] =
    useState<CortesiaPeriodo>("1mes");
  const [motivoCortesia, setMotivoCortesia] = useState("");
  const [senhaProvisoria, setSenhaProvisoria] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setShowSuspender(false);
    setMotivo("");
    setError(null);
  }

  function handleSuspender() {
    if (!motivo.trim()) {
      setError("Diga o motivo da suspensão.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await suspenderUsuario(userId, motivo.trim());
      if ("error" in r) {
        setError(r.error);
        return;
      }
      reset();
      setSuccess("Usuário suspenso");
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleReativar() {
    if (!confirm("Reativar este usuário? Ele volta a poder usar o app.")) return;
    setError(null);
    startTransition(async () => {
      const r = await reativarUsuario(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess("Usuário reativado");
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleExcluir() {
    if (
      !confirm(
        "Excluir este usuário? Soft delete — pode ser revertido em até 7 dias.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await excluirUsuario(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess("Usuário marcado pra exclusão");
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleCancelarExclusao() {
    setError(null);
    startTransition(async () => {
      const r = await cancelarExclusaoUsuario(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess("Exclusão cancelada");
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleApagarTodosPosts() {
    if (postsCount === 0) return;
    if (
      !confirm(
        `Apagar TODOS os ${postsCount} post${postsCount === 1 ? "" : "s"} desse usuário?\n\nFotos vão sair do storage. Não tem como desfazer.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await apagarTodosPostsDoUser(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess(
        r.quantos === 0
          ? "Nenhum post pra apagar"
          : `${r.quantos} post${r.quantos === 1 ? "" : "s"} apagado${r.quantos === 1 ? "" : "s"}`,
      );
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function resetCortesia() {
    setShowCortesia(false);
    setPeriodoCortesia("1mes");
    setMotivoCortesia("");
    setError(null);
  }

  function handleDarCortesia() {
    if (!motivoCortesia.trim()) {
      setError("Diga o motivo da cortesia.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await darVipCortesia(
        userId,
        periodoCortesia,
        motivoCortesia.trim(),
      );
      if ("error" in r) {
        setError(r.error);
        return;
      }
      resetCortesia();
      setSuccess(`VIP cortesia ativado (${CORTESIA_PERIODOS_LABEL[periodoCortesia]})`);
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  function handleResetarSenha() {
    if (
      !confirm(
        "Gerar senha provisória pra esse usuário?\n\nA senha atual dele vai ser trocada imediatamente. Você precisará enviar a nova senha pra ele.",
      )
    )
      return;
    setError(null);
    setSenhaProvisoria(null);
    startTransition(async () => {
      const r = await resetarSenhaProvisoria(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSenhaProvisoria(r.senha);
    });
  }

  function handleRevogarCortesia() {
    if (
      !confirm(
        "Revogar o VIP cortesia agora?\n\nO usuário perde o acesso VIP imediatamente.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const r = await revogarVipCortesia(userId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setSuccess("VIP cortesia revogado");
      window.setTimeout(() => setSuccess(null), 2500);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-2)",
          fontWeight: 700,
        }}
      >
        Ações
      </h2>

      {success && (
        <div
          role="status"
          className="rounded-xl p-2.5"
          style={{
            background: "rgba(149, 176, 115, 0.1)",
            border: "1px solid rgba(149, 176, 115, 0.4)",
            color: "oklch(0.82 0.09 140)",
            fontSize: 12,
          }}
        >
          ✓ {success}
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

      <div className="flex gap-2 flex-wrap">
        {!suspenso && !deletado && (
          <button
            type="button"
            onClick={() => setShowSuspender(true)}
            disabled={pending}
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid rgba(217,138,114,0.4)",
              color: "var(--rose-400)",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            🚫 Suspender acesso
          </button>
        )}
        {suspenso && (
          <button
            type="button"
            onClick={handleReativar}
            disabled={pending}
            className="btn-gold"
            style={{ padding: "8px 16px", fontSize: 11 }}
          >
            🔓 Reativar
          </button>
        )}

        {!deletado && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={pending}
            className="mono"
            style={{
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.5)",
              color: "var(--rose-400)",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            🗑 Excluir conta
          </button>
        )}

        {postsCount > 0 && (
          <button
            type="button"
            onClick={handleApagarTodosPosts}
            disabled={pending}
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid var(--line-strong)",
              color: "var(--text-2)",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
            title="Apaga todos os posts (fotos, likes, comentários) do user"
          >
            🧹 Apagar posts ({postsCount})
          </button>
        )}

        {!isVip && !deletado && (
          <button
            type="button"
            onClick={() => setShowCortesia(true)}
            disabled={pending}
            className="mono"
            style={{
              background: "var(--shine-gold)",
              border: "none",
              color: "#1a0f05",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 800,
            }}
            title="Dar VIP grátis pra esse usuário"
          >
            🎁 Dar VIP grátis
          </button>
        )}

        {isVip && (
          <button
            type="button"
            onClick={handleRevogarCortesia}
            disabled={pending}
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid rgba(217,138,114,0.4)",
              color: "var(--rose-400)",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
            title="Tira o VIP do user agora"
          >
            ✕ Revogar VIP
          </button>
        )}
        {deletado && (
          <button
            type="button"
            onClick={handleCancelarExclusao}
            disabled={pending}
            className="btn-gold"
            style={{ padding: "8px 16px", fontSize: 11 }}
          >
            ↩ Cancelar exclusão
          </button>
        )}

        {!deletado && (
          <button
            type="button"
            onClick={handleResetarSenha}
            disabled={pending}
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid var(--line-strong)",
              color: "var(--text-1)",
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              fontWeight: 700,
            }}
            title="Gera uma senha temporária pra enviar pro usuário"
          >
            🔑 Senha provisória
          </button>
        )}
      </div>

      {senhaProvisoria && (
        <div
          className="rounded-xl flex flex-col gap-2"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--gold-500)",
            padding: 14,
            marginTop: 4,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--gold-300)",
              fontWeight: 700,
            }}
          >
            🔑 Senha provisória gerada
          </div>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 4,
              color: "var(--text-0)",
              background: "var(--bg-1)",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              padding: "12px 16px",
              textAlign: "center",
              cursor: "pointer",
              userSelect: "all",
            }}
            onClick={() => {
              navigator.clipboard.writeText(senhaProvisoria);
            }}
            title="Clique pra copiar"
          >
            {senhaProvisoria}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
            Envie essa senha pro usuário e peça pra ele trocar após entrar.
            Clique na senha pra copiar.
          </div>
          <button
            type="button"
            onClick={() => setSenhaProvisoria(null)}
            className="btn-ghost"
            style={{ fontSize: 12, padding: "8px 12px", alignSelf: "flex-end" }}
          >
            Fechar
          </button>
        </div>
      )}

      {showSuspender && (
        <div
          className="rounded-xl flex flex-col gap-2"
          style={{
            background: "var(--bg-2)",
            border: "1px solid rgba(217,138,114,0.4)",
            padding: 12,
            marginTop: 4,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--rose-400)",
              fontWeight: 700,
            }}
          >
            Motivo da suspensão
          </div>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Ex: múltiplas denúncias por assédio confirmadas em 26/04"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "8px 10px",
              color: "var(--text-0)",
              fontSize: 13,
              fontFamily: "var(--font-ui)",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="btn-ghost flex-1"
              disabled={pending}
              style={{ padding: 10, fontSize: 12 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSuspender}
              disabled={pending}
              className="mono flex-1"
              style={{
                background: "rgba(217,138,114,0.15)",
                border: "1px solid var(--rose-400)",
                color: "var(--rose-400)",
                padding: "10px 14px",
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                cursor: pending ? "wait" : "pointer",
                fontWeight: 800,
              }}
            >
              {pending ? "Suspendendo..." : "Confirmar suspensão"}
            </button>
          </div>
        </div>
      )}

      {showCortesia && (
        <div
          className="rounded-xl flex flex-col gap-3"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--gold-500)",
            padding: 14,
            marginTop: 4,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--gold-300)",
              fontWeight: 700,
            }}
          >
            🎁 VIP Cortesia
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Período
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                Object.keys(CORTESIA_PERIODOS_LABEL) as CortesiaPeriodo[]
              ).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodoCortesia(p)}
                  className="mono"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    background:
                      periodoCortesia === p
                        ? "rgba(212,175,110,0.16)"
                        : "var(--bg-1)",
                    border:
                      periodoCortesia === p
                        ? "1px solid var(--gold-500)"
                        : "1px solid var(--line)",
                    color:
                      periodoCortesia === p
                        ? "var(--gold-300)"
                        : "var(--text-1)",
                    fontSize: 11,
                    letterSpacing: 1,
                    fontWeight: periodoCortesia === p ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {CORTESIA_PERIODOS_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--text-2)",
              }}
            >
              Motivo (registro interno)
            </span>
            <textarea
              value={motivoCortesia}
              onChange={(e) =>
                setMotivoCortesia(e.target.value.slice(0, 300))
              }
              rows={2}
              placeholder="Ex: parceria com a casa X, ganhador do sorteio de abril, embaixadora da comunidade..."
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "8px 10px",
                color: "var(--text-0)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetCortesia}
              className="btn-ghost flex-1"
              disabled={pending}
              style={{ padding: 10, fontSize: 12 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDarCortesia}
              disabled={pending}
              className="flex-1"
              style={{
                background: "var(--shine-gold)",
                border: "none",
                color: "#1a0f05",
                padding: "10px 14px",
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                cursor: pending ? "wait" : "pointer",
                fontWeight: 800,
              }}
            >
              {pending ? "Ativando..." : "Confirmar VIP grátis"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
