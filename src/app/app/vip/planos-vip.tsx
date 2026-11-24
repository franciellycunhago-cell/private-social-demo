"use client";

import { useState, useTransition } from "react";
import { iniciarTrial, type FormaPagamento } from "./actions";
import { PLANOS_INFO, type VipPlano } from "./planos";

/** Formata CPF enquanto digita: 000.000.000-00 */
function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function PlanosVip() {
  const [selecionado, setSelecionado] = useState<VipPlano>("anual");
  const [step, setStep] = useState<"plano" | "cpf">("plano");
  const [cpf, setCpf] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAvancar() {
    setError(null);
    setStep("cpf");
  }

  function handleConfirmar() {
    setError(null);
    if (cpf.replace(/\D/g, "").length !== 11) {
      setError("CPF precisa ter 11 dígitos.");
      return;
    }
    startTransition(async () => {
      const r = await iniciarTrial(selecionado, cpf, forma);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // Se Asaas já gerou link de pagamento, manda pra lá.
      // Senão (caso de trial sem 1ª cobrança ainda), vai pro perfil VIP.
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
      } else {
        window.location.href = "/app/perfil/vip?bemvindo=1";
      }
    });
  }

  if (step === "cpf") {
    const planoInfo = PLANOS_INFO[selecionado];
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setStep("plano");
            setError(null);
          }}
          className="mono"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-3)",
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            cursor: "pointer",
            alignSelf: "flex-start",
            padding: 0,
          }}
        >
          ‹ Trocar plano
        </button>

        <div
          className="rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,175,110,0.14), rgba(212,175,110,0.02))",
            border: "1px solid var(--gold-500)",
            padding: "14px 16px",
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
            Plano {selecionado}
          </div>
          <div
            className="display"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--gold-300)",
              marginTop: 2,
            }}
          >
            {planoInfo.valorLabel}
          </div>
          <div
            style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}
          >
            7 dias grátis · cobrança só no 8º dia
          </div>
        </div>

        <label className="flex flex-col gap-1.5 mt-2">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Seu CPF
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className="input-field"
            autoComplete="off"
          />
          <span style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5 }}>
            Necessário pra emitir cobrança. Não exibimos no perfil.
          </span>
        </label>

        {/* Forma de pagamento */}
        <div className="flex flex-col gap-1.5 mt-1">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            Forma de pagamento
          </span>
          <div className="grid grid-cols-2 gap-2">
            <FormaPagamentoCard
              tipo="pix"
              icone="⚡"
              titulo="Pix"
              desc="QR code novo todo mês"
              selecionado={forma === "pix"}
              onClick={() => setForma("pix")}
            />
            <FormaPagamentoCard
              tipo="cartao"
              icone="💳"
              titulo="Cartão"
              desc="Renovação automática"
              selecionado={forma === "cartao"}
              onClick={() => setForma("cartao")}
              destaque
            />
          </div>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              lineHeight: 1.5,
              marginTop: 2,
            }}
          >
            {forma === "cartao"
              ? "Cobrança automática mensal — cancela no perfil quando quiser."
              : "Você recebe o QR code Pix por email todo mês perto do vencimento."}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl p-3"
            style={{
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.3)",
              color: "var(--rose-400)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirmar}
          disabled={pending}
          className="btn-gold mt-1"
          style={{
            padding: "15px 24px",
            fontSize: 14,
            letterSpacing: 0.5,
            fontWeight: 700,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Processando..." : "Confirmar e ativar trial"}
        </button>

        <div
          className="text-center"
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Você não é cobrado nos próximos 7 dias.
          <br />
          Pode cancelar quando quiser no perfil.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PlanoCard
        plano="mensal"
        selecionado={selecionado === "mensal"}
        onClick={() => setSelecionado("mensal")}
      />
      <PlanoCard
        plano="anual"
        selecionado={selecionado === "anual"}
        onClick={() => setSelecionado("anual")}
        destaque="MAIS POPULAR"
      />
      <PlanoCard
        plano="trimestral"
        selecionado={selecionado === "trimestral"}
        onClick={() => setSelecionado("trimestral")}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl p-3 mt-2"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleAvancar}
        disabled={pending}
        className="btn-gold mt-3"
        style={{
          padding: "15px 24px",
          fontSize: 14,
          letterSpacing: 0.5,
          fontWeight: 700,
        }}
      >
        Começar 7 dias grátis
      </button>

      <div
        className="text-center"
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        Sem cobrança nos primeiros 7 dias.
        <br />
        Cancela a qualquer momento.
      </div>
    </div>
  );
}

function FormaPagamentoCard({
  icone,
  titulo,
  desc,
  selecionado,
  destaque,
  onClick,
}: {
  tipo: FormaPagamento;
  icone: string;
  titulo: string;
  desc: string;
  selecionado: boolean;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        textAlign: "left",
        background: selecionado
          ? "linear-gradient(135deg, rgba(212,175,110,0.16), rgba(212,175,110,0.04))"
          : "var(--bg-1)",
        border: selecionado
          ? "2px solid var(--gold-500)"
          : "1px solid var(--line)",
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.18s ease",
      }}
    >
      {destaque && !selecionado && (
        <span
          className="mono"
          style={{
            position: "absolute",
            top: -8,
            right: 8,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: 1,
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          AUTO
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <span style={{ fontSize: 22 }}>{icone}</span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: selecionado ? "var(--gold-300)" : "var(--text-0)",
              marginBottom: 1,
            }}
          >
            {titulo}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.4 }}>
            {desc}
          </div>
        </div>
      </div>
    </button>
  );
}

function PlanoCard({
  plano,
  selecionado,
  destaque,
  onClick,
}: {
  plano: VipPlano;
  selecionado: boolean;
  destaque?: string;
  onClick: () => void;
}) {
  const info = PLANOS_INFO[plano];
  const labels: Record<VipPlano, string> = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    anual: "Anual",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        position: "relative",
        background: selecionado
          ? "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))"
          : "var(--bg-1)",
        border: selecionado
          ? "2px solid var(--gold-500)"
          : "1px solid var(--line)",
        borderRadius: 16,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: selecionado
          ? "0 0 24px rgba(212,175,110,0.15)"
          : "none",
      }}
    >
      {destaque && (
        <span
          className="mono"
          style={{
            position: "absolute",
            top: -10,
            right: 14,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.2,
            padding: "3px 9px",
            borderRadius: 999,
          }}
        >
          {destaque}
        </span>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="display"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: selecionado ? "var(--gold-300)" : "var(--text-0)",
            }}
          >
            {labels[plano]}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              marginTop: 2,
            }}
          >
            {info.perMes}
            {info.descontoLabel && (
              <span
                className="mono"
                style={{
                  marginLeft: 6,
                  color: "oklch(0.82 0.09 140)",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: 0.5,
                }}
              >
                · {info.descontoLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: selecionado ? "var(--gold-300)" : "var(--text-1)",
            }}
          >
            {info.valorLabel}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "var(--text-3)",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {plano === "mensal"
              ? "por mês"
              : plano === "trimestral"
                ? "a cada 3 meses"
                : "por ano"}
          </div>
        </div>

        {/* Radio visual */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: selecionado
              ? "6px solid var(--gold-500)"
              : "1px solid var(--line-strong)",
            background: selecionado ? "var(--gold-500)" : "transparent",
          }}
        />
      </div>
    </button>
  );
}
