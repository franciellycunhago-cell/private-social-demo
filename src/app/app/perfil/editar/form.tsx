"use client";

import { useActionState, useMemo, useState } from "react";
import { updateProfile, type UpdateProfileState } from "./actions";
import type {
  Experiencia,
  ProfileRow,
  ProfileTipo,
} from "@/lib/supabase/profile";

/* ====================================================================
 * Form de edição de perfil.
 *
 * Reusa a UX do onboarding: chips pra tipo, intenções, limites, experiência.
 * Revalida no server via Server Action updateProfile.
 * ================================================================== */

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

const TIPOS: { value: ProfileTipo; label: string; hint: string }[] = [
  { value: "casal", label: "Casal", hint: "dois perfis juntos" },
  { value: "mulher", label: "Mulher solo", hint: "vive sozinha o app" },
  { value: "homem", label: "Homem solo", hint: "vive sozinho o app" },
];

const EXPERIENCIAS: { value: Experiencia; label: string }[] = [
  { value: "curioso", label: "Curioso" },
  { value: "iniciante", label: "Iniciante" },
  { value: "experiente", label: "Experiente" },
  { value: "veterano", label: "Veterano" },
];

const HANDLE_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;

export function EditProfileForm({ initial }: { initial: ProfileRow }) {
  const [tipo, setTipo] = useState<ProfileTipo>(initial.tipo ?? "casal");
  const [intencoes, setIntencoes] = useState<string[]>(initial.intencoes ?? []);
  const [limites, setLimites] = useState<string[]>(initial.limites ?? []);
  const [experiencia, setExperiencia] = useState<Experiencia>(
    initial.experiencia ?? "curioso",
  );
  const [handle, setHandle] = useState(initial.handle ?? "");

  const [state, formAction, pending] = useActionState<
    UpdateProfileState,
    FormData
  >(updateProfile, null);

  const disabled = pending;

  const saved = useMemo(() => state?.ok === true && !state.error, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="experiencia" value={experiencia} />
      <input type="hidden" name="intencoes" value={JSON.stringify(intencoes)} />
      <input type="hidden" name="limites" value={JSON.stringify(limites)} />

      <Section title="Seu @handle">
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
            className="input-field"
            name="handle"
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))
            }
            placeholder="marina.rafael"
            style={{ paddingLeft: 30 }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            required
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>
          {HANDLE_RE.test(handle)
            ? `✓ @${handle}`
            : "Mínimo 3 caracteres · letras, números, . e _"}
        </div>
      </Section>

      <Section title="Quem é você">
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <ChipBtn
              key={t.value}
              active={tipo === t.value}
              onClick={() => setTipo(t.value)}
            >
              <div style={{ fontWeight: 600 }}>{t.label}</div>
              <div
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: "var(--text-3)",
                }}
              >
                {t.hint}
              </div>
            </ChipBtn>
          ))}
        </div>
      </Section>

      <Section title="Como aparecer">
        <Label>Nome de exibição</Label>
        <input
          className="input-field"
          name="nome_exibicao"
          defaultValue={initial.nome_exibicao ?? ""}
          placeholder={tipo === "casal" ? "Marina & Rafael" : "Júlia"}
          required
          maxLength={60}
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <Label>{tipo === "casal" ? "Idade 1" : "Idade"}</Label>
            <input
              className="input-field"
              name="idade_1"
              type="number"
              min={18}
              max={99}
              defaultValue={initial.idade_1 ?? ""}
              required
            />
          </div>
          {tipo === "casal" && (
            <div>
              <Label>Idade 2</Label>
              <input
                className="input-field"
                name="idade_2"
                type="number"
                min={18}
                max={99}
                defaultValue={initial.idade_2 ?? ""}
                required
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3 mt-3">
          <div>
            <Label>Cidade</Label>
            <input
              className="input-field"
              name="cidade"
              defaultValue={initial.cidade ?? ""}
              placeholder="São Paulo"
              required
              maxLength={60}
            />
          </div>
          <div>
            <Label>UF</Label>
            <input
              className="input-field"
              name="estado"
              defaultValue={initial.estado ?? ""}
              placeholder="SP"
              maxLength={2}
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>
      </Section>

      <Section title="Experiência">
        <div className="grid grid-cols-2 gap-2">
          {EXPERIENCIAS.map((e) => (
            <ChipBtn
              key={e.value}
              active={experiencia === e.value}
              onClick={() => setExperiencia(e.value)}
            >
              <div style={{ fontWeight: 600 }}>{e.label}</div>
            </ChipBtn>
          ))}
        </div>
      </Section>

      <Section
        title="Intenções"
        hint="Toque no que descreve vocês"
      >
        <ChipList
          options={INTENCOES}
          selected={intencoes}
          onToggle={(v) =>
            setIntencoes((curr) =>
              curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v],
            )
          }
        />
      </Section>

      <Section
        title="Limites e preferências"
        hint="Opcional — ajuda a filtrar interações"
      >
        <ChipList
          options={LIMITES}
          selected={limites}
          onToggle={(v) =>
            setLimites((curr) =>
              curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v],
            )
          }
        />
      </Section>

      <Section title="Bio">
        <textarea
          className="input-field"
          name="bio"
          rows={4}
          maxLength={600}
          defaultValue={initial.bio ?? ""}
          placeholder="Conta um pouco sobre vocês, o que buscam, como gostam de conhecer pessoas…"
          style={{ resize: "vertical", minHeight: 100 }}
        />
      </Section>

      {state?.error && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "rgba(217, 138, 114, 0.08)",
            border: "1px solid rgba(217, 138, 114, 0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
          }}
          role="alert"
        >
          {state.error}
        </div>
      )}

      {saved && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "rgba(149, 176, 115, 0.12)",
            border: "1px solid rgba(149, 176, 115, 0.35)",
            color: "oklch(0.82 0.09 140)",
            fontSize: 13,
          }}
          role="status"
        >
          Perfil atualizado ✓
        </div>
      )}

      <button
        type="submit"
        className="btn-gold w-full"
        style={{ padding: 14 }}
        disabled={disabled}
      >
        {disabled ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-2)",
        }}
      >
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{hint}</div>
      )}
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "10px 12px",
        textAlign: "left",
        borderRadius: 14,
        fontSize: 13,
        background: active
          ? "linear-gradient(135deg, rgba(212,175,110,0.2), rgba(212,175,110,0.04))"
          : "rgba(255,255,255,0.03)",
        border: active ? "1px solid var(--gold-500)" : "1px solid var(--line)",
        color: active ? "var(--gold-100)" : "var(--text-1)",
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </button>
  );
}

function ChipList({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((v) => {
        const active = selected.includes(v);
        return (
          <button
            type="button"
            key={v}
            onClick={() => onToggle(v)}
            className={active ? "chip gold" : "chip"}
            aria-pressed={active}
            style={{
              cursor: "pointer",
              border: active
                ? "1px solid var(--gold-500)"
                : "1px solid var(--line)",
            }}
          >
            {active && <span style={{ fontSize: 10 }}>✓</span>}
            {v}
          </button>
        );
      })}
    </div>
  );
}
