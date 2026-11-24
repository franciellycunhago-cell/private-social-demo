"use client";

import { useActionState, useMemo, useState } from "react";
import { saveOnboarding, type OnboardingState } from "./actions";

/* ====================================================================
 * Onboarding — 5 etapas
 *  1. Quem é você (tipo: casal/homem/mulher)
 *  2. O que busca (intenções)
 *  3. Seus limites
 *  4. Seu perfil (nome, idade, cidade, experiência, bio)
 *  5. Revisão e envio → saveOnboarding() redireciona pra /verificacao
 *
 * Referência de design: PrivateSocial.html + handoff/.../onboarding.jsx
 * ================================================================== */

type Tipo = "casal" | "homem" | "mulher";
type Experiencia = "curioso" | "iniciante" | "experiente" | "veterano";

type Data = {
  tipo: Tipo | null;
  intencoes: string[];
  limites: string[];
  handle: string;
  nome_exibicao: string;
  idade_1: string;
  idade_2: string;
  cidade: string;
  estado: string;
  experiencia: Experiencia | null;
  bio: string;
  telefone: string;
};

const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;
const TELEFONE_RE = /^\(\d{2}\) \d{4,5}-\d{4}$/;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const INTENCOES = [
  "Amizade",
  "Experiência casual",
  "Swing",
  "Relacionamento aberto",
  "Sexo virtual",
  "Encontros reais",
  "Só conversar",
  "Fetiches específicos",
];

const LIMITES = [
  "Apenas casais",
  "Casal + mulher",
  "Casal + homem",
  "Troca de casais",
  "Voyeurismo",
  "Exibicionismo",
  "Softswing",
  "Sem penetração",
  "Sempre com preservativo",
  "Dispensamos bebidas",
];

const EXPERIENCIA_LABELS: Record<Experiencia, string> = {
  curioso: "Curiosos",
  iniciante: "Iniciantes",
  experiente: "Experientes",
  veterano: "Veteranos",
};

const TOTAL_STEPS = 5;

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Data>({
    tipo: null,
    intencoes: [],
    limites: [],
    handle: "",
    nome_exibicao: "",
    idade_1: "",
    idade_2: "",
    cidade: "",
    estado: "",
    experiencia: null,
    bio: "",
    telefone: "",
  });
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    saveOnboarding,
    null,
  );

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return data.tipo !== null;
      case 2:
        return data.intencoes.length > 0;
      case 3:
        return true;
      case 4: {
        const idade1 = Number(data.idade_1);
        const idade2 = Number(data.idade_2);
        if (!HANDLE_RE.test(data.handle)) return false;
        if (!data.nome_exibicao.trim()) return false;
        if (!Number.isFinite(idade1) || idade1 < 18) return false;
        if (data.tipo === "casal" && (!Number.isFinite(idade2) || idade2 < 18))
          return false;
        if (!data.cidade.trim()) return false;
        if (!data.experiencia) return false;
        if (!TELEFONE_RE.test(data.telefone)) return false;
        return true;
      }
      case 5:
        return true;
    }
    return false;
  }, [step, data]);

  function toggleInArray(key: "intencoes" | "limites", value: string) {
    setData((d) => ({
      ...d,
      [key]: d[key].includes(value)
        ? d[key].filter((x) => x !== value)
        : [...d[key], value],
    }));
  }

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg-0)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, #2a1810 0%, #0a0706 60%)",
        }}
      />
      <div
        aria-hidden
        className="starry pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-30"
      />

      <div className="relative z-10 flex min-h-dvh flex-col max-w-md mx-auto px-6 pt-14 pb-10">
        {/* Progress header */}
        <div className="flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              aria-label="Voltar"
              className="grid place-items-center w-9 h-9 rounded-xl border text-[var(--text-1)]"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "var(--line)",
              }}
            >
              <ChevronLeft />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[3px] rounded-sm transition-colors"
                style={{
                  background:
                    i < step
                      ? "var(--gold-400)"
                      : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--text-3)" }}
          >
            {step}/{TOTAL_STEPS}
          </div>
        </div>

        <div className="flex-1 pt-8 pb-4">
          {step === 1 && (
            <Section
              title="Quem é você?"
              subtitle="Isso define o que você vai ver — e quem vai te encontrar."
            >
              <div className="flex flex-col gap-2.5">
                <SelectCard
                  selected={data.tipo === "casal"}
                  onClick={() => setData({ ...data, tipo: "casal" })}
                  title="Casal"
                  subtitle="Nós dois, juntos, em um só perfil"
                />
                <SelectCard
                  selected={data.tipo === "homem"}
                  onClick={() => setData({ ...data, tipo: "homem" })}
                  title="Homem solo"
                  subtitle="Individual, interessado no universo liberal"
                />
                <SelectCard
                  selected={data.tipo === "mulher"}
                  onClick={() => setData({ ...data, tipo: "mulher" })}
                  title="Mulher solo"
                  subtitle="Individual, interessada no universo liberal"
                />
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section
              title="O que você busca?"
              subtitle="Selecione tudo que se aplica. Pode ajustar depois."
            >
              <div className="flex flex-wrap gap-2">
                {INTENCOES.map((o) => (
                  <Chip
                    key={o}
                    selected={data.intencoes.includes(o)}
                    onClick={() => toggleInArray("intencoes", o)}
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section
              title="Seus limites"
              subtitle="Transparência protege todo mundo. Só seu match vê isso."
            >
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
                style={{
                  background: "rgba(212, 175, 110, 0.06)",
                  border: "1px solid var(--line)",
                }}
              >
                <ShieldIcon />
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-2)",
                    lineHeight: 1.45,
                  }}
                >
                  Marque <b style={{ color: "var(--gold-300)" }}>sim</b> no que
                  aceita. O resto fica privado até você querer conversar.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {LIMITES.map((o) => (
                  <Chip
                    key={o}
                    selected={data.limites.includes(o)}
                    onClick={() => toggleInArray("limites", o)}
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {step === 4 && (
            <Section
              title="Seu perfil"
              subtitle="Como você quer aparecer."
            >
              <div className="flex flex-col gap-3.5">
                <Field label="Seu @handle">
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--gold-400)",
                        fontSize: 15,
                        fontWeight: 700,
                        pointerEvents: "none",
                      }}
                    >
                      @
                    </span>
                    <input
                      value={data.handle}
                      onChange={(e) =>
                        setData({
                          ...data,
                          handle: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9._]/g, ""),
                        })
                      }
                      placeholder="marina.rafael"
                      className="input-field"
                      style={{ paddingLeft: 30 }}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={30}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: HANDLE_RE.test(data.handle)
                        ? "var(--gold-400)"
                        : "var(--text-3)",
                      marginTop: 5,
                    }}
                  >
                    {HANDLE_RE.test(data.handle)
                      ? `✓ @${data.handle} disponível para verificação`
                      : "Mínimo 3 caracteres · letras, números, . e _"}
                  </div>
                </Field>

                <Field label="Nome de exibição">
                  <input
                    value={data.nome_exibicao}
                    onChange={(e) =>
                      setData({ ...data, nome_exibicao: e.target.value })
                    }
                    placeholder={
                      data.tipo === "casal"
                        ? "Ex: Marina & Rafael"
                        : "Ex: Camila"
                    }
                    className="input-field"
                    autoComplete="off"
                  />
                </Field>

                <div className="flex gap-2.5">
                  <Field
                    label={
                      data.tipo === "casal" ? "Idade — ela" : "Sua idade"
                    }
                  >
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={data.idade_1}
                      onChange={(e) =>
                        setData({ ...data, idade_1: e.target.value })
                      }
                      placeholder="18+"
                      className="input-field"
                    />
                  </Field>
                  {data.tipo === "casal" && (
                    <Field label="Idade — ele">
                      <input
                        type="number"
                        min={18}
                        max={99}
                        value={data.idade_2}
                        onChange={(e) =>
                          setData({ ...data, idade_2: e.target.value })
                        }
                        placeholder="18+"
                        className="input-field"
                      />
                    </Field>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <Field label="Cidade">
                    <input
                      value={data.cidade}
                      onChange={(e) =>
                        setData({ ...data, cidade: e.target.value })
                      }
                      placeholder="São Paulo"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Estado (UF)">
                    <input
                      value={data.estado}
                      onChange={(e) =>
                        setData({
                          ...data,
                          estado: e.target.value.toUpperCase().slice(0, 2),
                        })
                      }
                      placeholder="SP"
                      className="input-field"
                    />
                  </Field>
                </div>

                <Field label="Experiência no meio liberal">
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.keys(EXPERIENCIA_LABELS) as Experiencia[]
                    ).map((k) => (
                      <Chip
                        key={k}
                        selected={data.experiencia === k}
                        onClick={() => setData({ ...data, experiencia: k })}
                      >
                        {EXPERIENCIA_LABELS[k]}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <Field label="Bio (opcional)">
                  <textarea
                    value={data.bio}
                    onChange={(e) => setData({ ...data, bio: e.target.value })}
                    rows={3}
                    placeholder="Conta em 2-3 linhas como é conviver com vocês..."
                    className="input-field"
                    style={{ resize: "none", minHeight: 84 }}
                  />
                </Field>

                <Field label="Celular *">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={data.telefone}
                    onChange={(e) =>
                      setData({ ...data, telefone: formatPhone(e.target.value) })
                    }
                    placeholder="(11) 99999-9999"
                    className="input-field"
                    autoComplete="tel"
                    maxLength={15}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: TELEFONE_RE.test(data.telefone)
                        ? "var(--gold-400)"
                        : "var(--text-3)",
                      marginTop: 5,
                    }}
                  >
                    {TELEFONE_RE.test(data.telefone)
                      ? "✓ Número válido"
                      : "Só você e os admins veem. Usado para verificação de identidade."}
                  </div>
                </Field>
              </div>
            </Section>
          )}

          {step === 5 && (
            <Section
              title="Tudo certo?"
              subtitle="Confere antes de mandar. Depois disso, vamos para a verificação."
            >
              <div className="card p-5 flex flex-col gap-3">
                <Review label="Tipo">
                  {data.tipo === "casal"
                    ? "Casal"
                    : data.tipo === "homem"
                    ? "Homem solo"
                    : "Mulher solo"}
                </Review>
                <Review label="Handle">@{data.handle}</Review>
                <Review label="Nome">{data.nome_exibicao}</Review>
                <Review label="Idade">
                  {data.tipo === "casal"
                    ? `${data.idade_1} & ${data.idade_2}`
                    : data.idade_1}
                </Review>
                <Review label="Cidade">
                  {data.cidade}
                  {data.estado ? ` · ${data.estado}` : ""}
                </Review>
                <Review label="Experiência">
                  {data.experiencia
                    ? EXPERIENCIA_LABELS[data.experiencia]
                    : "—"}
                </Review>
                <Review label="Busca">
                  {data.intencoes.join(" · ")}
                </Review>
                {data.limites.length > 0 && (
                  <Review label="Limites">
                    {data.limites.join(" · ")}
                  </Review>
                )}
                {data.bio && <Review label="Bio">{data.bio}</Review>}
                <Review label="Celular">{data.telefone}</Review>
              </div>
            </Section>
          )}

          {state?.error && (
            <div
              className="mt-4 text-sm"
              style={{ color: "var(--rose-400)" }}
              role="alert"
            >
              {state.error}
            </div>
          )}
        </div>

        {/* CTA */}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            className="btn-gold w-full"
            style={{ padding: 16 }}
          >
            Continuar
          </button>
        ) : (
          <form action={formAction} className="w-full">
            {data.tipo && (
              <input type="hidden" name="tipo" value={data.tipo} />
            )}
            <input type="hidden" name="handle" value={data.handle} />
            <input
              type="hidden"
              name="nome_exibicao"
              value={data.nome_exibicao}
            />
            <input type="hidden" name="idade_1" value={data.idade_1} />
            <input
              type="hidden"
              name="idade_2"
              value={data.tipo === "casal" ? data.idade_2 : ""}
            />
            <input type="hidden" name="cidade" value={data.cidade} />
            <input type="hidden" name="estado" value={data.estado} />
            {data.experiencia && (
              <input
                type="hidden"
                name="experiencia"
                value={data.experiencia}
              />
            )}
            <input type="hidden" name="bio" value={data.bio} />
            <input type="hidden" name="telefone" value={data.telefone} />
            <input
              type="hidden"
              name="intencoes"
              value={JSON.stringify(data.intencoes)}
            />
            <input
              type="hidden"
              name="limites"
              value={JSON.stringify(data.limites)}
            />
            <button
              type="submit"
              disabled={pending || !canAdvance}
              className="btn-gold w-full"
              style={{ padding: 16 }}
            >
              {pending ? "Enviando…" : "Enviar e verificar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== */
/* Subcomponentes                                                        */
/* ==================================================================== */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fade-up">
      <div
        className="display"
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--text-0)",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      <div
        className="mt-2 mb-7"
        style={{
          fontSize: 14,
          color: "var(--text-2)",
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </div>
      {children}
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex items-center gap-3 p-4 rounded-2xl transition-all"
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(212, 175, 110, 0.18), rgba(212, 175, 110, 0.05))"
          : "var(--bg-1)",
        border: selected
          ? "1.5px solid var(--gold-400)"
          : "1px solid var(--line)",
        boxShadow: selected ? "0 0 0 4px rgba(212,175,110,0.08)" : "none",
        color: "var(--text-0)",
      }}
    >
      <div className="flex-1">
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div
          className="mt-0.5"
          style={{ fontSize: 12, color: "var(--text-2)" }}
        >
          {subtitle}
        </div>
      </div>
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: 20,
          height: 20,
          border: selected ? "none" : "1.5px solid var(--line-strong)",
          background: selected ? "var(--shine-gold)" : "transparent",
        }}
      >
        {selected && <CheckSmall />}
      </div>
    </button>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-colors"
      style={{
        padding: "9px 15px",
        borderRadius: 999,
        background: selected
          ? "linear-gradient(135deg, rgba(212,175,110,0.25), rgba(212,175,110,0.1))"
          : "rgba(255,255,255,0.03)",
        border: selected
          ? "1px solid var(--gold-400)"
          : "1px solid var(--line)",
        color: selected ? "var(--gold-100)" : "var(--text-1)",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex-1 flex flex-col">
      <span
        className="mono mb-1.5"
        style={{
          fontSize: 11,
          color: "var(--text-2)",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Review({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="mono flex-shrink-0"
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          width: 88,
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: "var(--text-0)", lineHeight: 1.4 }}>
        {children}
      </span>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckSmall() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1a0f05"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--gold-400)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
