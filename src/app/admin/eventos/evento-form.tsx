"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveEvento, deleteEvento, type EventoFormPayload } from "./actions";

/* ====================================================================
 * EventoForm — modal de criar/editar evento.
 *
 *  - Uploader de capa direto no bucket `eventos` (path = eventos/{uuid}.jpg)
 *  - Inputs nativos pra data/hora (combinados em ISO)
 *  - "Salvar rascunho" (publicado=false) vs "Publicar" (publicado=true)
 *  - Deletar com confirm
 * ================================================================== */

export type EventoFormValues = {
  id?: string;
  titulo: string;
  descricao: string | null;
  data: string | null; // ISO completo
  local: string | null;
  cidade: string | null;
  capacidade: number | null;
  dress_code: string | null;
  tipo: "proprio" | "patrocinado";
  patrocinador_nome: string | null;
  valor_patrocinio: number | null;
  foto_url: string | null;
  vip_only: boolean;
  publicado: boolean;
  destacado: boolean;
};

const overlayInput: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  fontSize: 0,
};

function isoToLocalParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function partsToIso(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "22:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  const local = new Date(y, (m ?? 1) - 1, d, hh ?? 22, mm ?? 0, 0, 0);
  return local.toISOString();
}

export function EventoForm({
  initial,
  onClose,
}: {
  initial: EventoFormValues;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const parts = useMemo(() => isoToLocalParts(initial.data), [initial.data]);

  const [titulo, setTitulo] = useState(initial.titulo);
  const [descricao, setDescricao] = useState(initial.descricao ?? "");
  const [dateStr, setDateStr] = useState(parts.date);
  const [timeStr, setTimeStr] = useState(parts.time || "22:00");
  const [local, setLocal] = useState(initial.local ?? "");
  const [cidade, setCidade] = useState(initial.cidade ?? "");
  const [capacidade, setCapacidade] = useState(
    initial.capacidade?.toString() ?? "",
  );
  const [dressCode, setDressCode] = useState(initial.dress_code ?? "");
  const [tipo, setTipo] = useState<"proprio" | "patrocinado">(initial.tipo);
  const [patrocinadorNome, setPatrocinadorNome] = useState(
    initial.patrocinador_nome ?? "",
  );
  const [valorPatrocinio, setValorPatrocinio] = useState(
    initial.valor_patrocinio?.toString() ?? "",
  );
  const [vipOnly, setVipOnly] = useState(initial.vip_only);
  const [destacado, setDestacado] = useState(initial.destacado);
  const [fotoUrl, setFotoUrl] = useState<string | null>(initial.foto_url);
  const [fotoPreview, setFotoPreview] = useState<string | null>(
    initial.foto_url
      ? initial.foto_url.startsWith("http")
        ? initial.foto_url
        : supabase.storage.from("eventos").getPublicUrl(initial.foto_url).data
            .publicUrl
      : null,
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function compressToJpeg(file: File): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    });
    const max = 1600;
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_not_supported");
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
        "image/jpeg",
        0.85,
      );
    });
  }

  async function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    setError(null);
    setUploading(true);
    try {
      const compressed = await compressToJpeg(f);
      const path = `capa-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("eventos")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      setFotoUrl(path);
      const { data } = supabase.storage.from("eventos").getPublicUrl(path);
      setFotoPreview(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(publicado: boolean): EventoFormPayload | null {
    const iso = partsToIso(dateStr, timeStr);
    if (!titulo.trim()) {
      setError("Informe o título.");
      return null;
    }
    if (!iso) {
      setError("Informe a data.");
      return null;
    }
    return {
      id: initial.id,
      titulo,
      descricao: descricao || null,
      data: iso,
      local: local || null,
      cidade: cidade || null,
      capacidade: capacidade ? Number.parseInt(capacidade, 10) : null,
      dress_code: dressCode || null,
      tipo,
      patrocinador_nome: tipo === "patrocinado" ? patrocinadorNome || null : null,
      valor_patrocinio:
        tipo === "patrocinado" && valorPatrocinio
          ? Number.parseFloat(valorPatrocinio.replace(",", "."))
          : null,
      foto_url: fotoUrl,
      vip_only: vipOnly,
      destacado,
      publicado,
    };
  }

  function submit(publicado: boolean) {
    setError(null);
    const payload = buildPayload(publicado);
    if (!payload) return;
    startTransition(async () => {
      const result = await saveEvento(payload);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  function handleDelete() {
    if (!initial.id) return;
    if (!confirm(`Apagar o evento "${initial.titulo}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteEvento(initial.id!);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{
        background: "rgba(5,3,2,0.72)",
        backdropFilter: "blur(6px)",
        padding: "32px 16px",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <div
              className="display"
              style={{ fontSize: 22, color: "var(--text-0)", fontWeight: 500 }}
            >
              {initial.id ? "Editar evento" : "Novo evento"}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--text-3)",
                marginTop: 4,
              }}
            >
              {initial.publicado ? "Publicado" : "Rascunho"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--line)",
              color: "var(--text-1)",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Capa */}
          <div className="flex flex-col gap-2">
            <Label>Capa</Label>
            <label
              className="relative block overflow-hidden rounded-xl cursor-pointer"
              style={{
                aspectRatio: "16/9",
                background: "var(--bg-2)",
                border: "1px dashed var(--gold-600)",
              }}
            >
              {fotoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fotoPreview}
                  alt=""
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                  style={{ color: "var(--gold-300)" }}
                >
                  <span style={{ fontSize: 26 }}>＋</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {uploading ? "Enviando…" : "Adicionar capa"}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onFotoChange}
                disabled={uploading}
                aria-label="Enviar capa"
                style={overlayInput}
              />
              {fotoPreview && (
                <div
                  className="absolute"
                  style={{
                    bottom: 10,
                    right: 10,
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.6)",
                    color: "var(--text-0)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  trocar
                </div>
              )}
            </label>
          </div>

          {/* Título */}
          <Field label="Título">
            <input
              className="input-field"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Noite Dourada"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                className="input-field"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                className="input-field"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Local">
            <input
              className="input-field"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Endereço só revelado aos confirmados"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cidade">
              <input
                className="input-field"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Blumenau · SC"
              />
            </Field>
            <Field label="Capacidade">
              <input
                type="number"
                className="input-field"
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                placeholder="40"
              />
            </Field>
          </div>

          <Field label="Dress code">
            <input
              className="input-field"
              value={dressCode}
              onChange={(e) => setDressCode(e.target.value)}
              placeholder="Preto elegante · máscara opcional"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              className="input-field"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Uma noite para celebrar o desejo…"
              style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select
                className="input-field"
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value as "proprio" | "patrocinado")
                }
              >
                <option value="proprio">Próprio (Admin)</option>
                <option value="patrocinado">Patrocinado por 3º</option>
              </select>
            </Field>
            <Field label="Acesso">
              <select
                className="input-field"
                value={vipOnly ? "vip" : "todos"}
                onChange={(e) => setVipOnly(e.target.value === "vip")}
              >
                <option value="todos">Todos os membros verificados</option>
                <option value="vip">Apenas VIP</option>
              </select>
            </Field>
          </div>

          {/* Toggle destacado */}
          <label
            className="flex items-center gap-3 rounded-xl p-3 cursor-pointer"
            style={{
              background: destacado
                ? "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))"
                : "var(--bg-2)",
              border: destacado
                ? "1px solid var(--gold-500)"
                : "1px solid var(--line)",
            }}
          >
            <input
              type="checkbox"
              checked={destacado}
              onChange={(e) => setDestacado(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                accentColor: "var(--gold-400)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="flex items-center gap-1.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: destacado ? "var(--gold-300)" : "var(--text-0)",
                }}
              >
                <span>★</span>
                Destacar no topo
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-3)",
                  marginTop: 2,
                  lineHeight: 1.35,
                }}
              >
                Aparece no hero grande do feed /app/eventos e no banner
                rotativo do /app/descobrir. Só 1 evento destacado por vez —
                marcando esse, desmarca os outros automaticamente.
              </div>
            </div>
          </label>

          {tipo === "patrocinado" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Patrocinador">
                <input
                  className="input-field"
                  value={patrocinadorNome}
                  onChange={(e) => setPatrocinadorNome(e.target.value)}
                  placeholder="Nome do casal / casa"
                />
              </Field>
              <Field label="Valor do patrocínio (R$)">
                <input
                  className="input-field"
                  value={valorPatrocinio}
                  onChange={(e) => setValorPatrocinio(e.target.value)}
                  placeholder="300"
                />
              </Field>
            </div>
          )}

          {error && (
            <div
              className="rounded-xl px-3 py-2"
              role="alert"
              style={{
                background: "rgba(217, 138, 114, 0.08)",
                border: "1px solid rgba(217, 138, 114, 0.3)",
                color: "var(--rose-400)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"
          style={{
            borderTop: "1px solid var(--line)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <div>
            {initial.id && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="mono"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(217,138,114,0.35)",
                  color: "var(--rose-400)",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                Apagar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={pending}
              className="btn-ghost"
              style={{ padding: "10px 16px", fontSize: 13 }}
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="btn-gold"
              style={{ padding: "10px 18px", fontSize: 13 }}
            >
              {pending ? "Salvando…" : initial.publicado ? "Atualizar" : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: "var(--text-3)",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
