"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerStory } from "./actions";

/* ====================================================================
 * StoryUploader — aceita foto ou vídeo curto.
 *  - Foto: compressão JPEG 1400px
 *  - Vídeo: sem compressão (browsers ainda não suportam bem); valida
 *    duração <= 30s e tamanho <= 40MB; upload direto mp4/mov
 *  - Caption opcional (200 chars)
 * ================================================================== */

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

const VIDEO_MAX_DUR_MS = 30_000;
const VIDEO_MAX_BYTES = 40 * 1024 * 1024;

type MediaState =
  | { kind: "image"; file: File; previewUrl: string }
  | {
      kind: "video";
      file: File;
      previewUrl: string;
      duracaoMs: number;
    };

export type EventoOpcao = {
  id: string;
  titulo: string;
  dataFmt: string;
};

export function StoryUploader({
  eventos = [],
}: {
  eventos?: EventoOpcao[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [media, setMedia] = useState<MediaState | null>(null);
  const [texto, setTexto] = useState("");
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const eventoSelecionado = eventos.find((e) => e.id === eventoId) ?? null;

  function reset() {
    if (media) URL.revokeObjectURL(media.previewUrl);
    setMedia(null);
    setTexto("");
    setEventoId(null);
    setError(null);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);

    if (f.type.startsWith("image/")) {
      if (media) URL.revokeObjectURL(media.previewUrl);
      setMedia({ kind: "image", file: f, previewUrl: URL.createObjectURL(f) });
      return;
    }

    if (f.type.startsWith("video/")) {
      if (f.size > VIDEO_MAX_BYTES) {
        setError(
          `Vídeo grande demais (${formatBytes(f.size)}). Máximo 40MB.`,
        );
        return;
      }
      const url = URL.createObjectURL(f);
      try {
        const duracaoMs = await obterDuracaoVideo(url);
        if (duracaoMs > VIDEO_MAX_DUR_MS) {
          URL.revokeObjectURL(url);
          setError(
            `Vídeo de ${Math.round(duracaoMs / 1000)}s — máximo 30s.`,
          );
          return;
        }
        if (media) URL.revokeObjectURL(media.previewUrl);
        setMedia({ kind: "video", file: f, previewUrl: url, duracaoMs });
      } catch {
        URL.revokeObjectURL(url);
        setError("Não consegui ler o vídeo. Tenta outro.");
      }
      return;
    }

    setError("Envie uma foto ou vídeo.");
  }

  async function compressToJpeg(src: File): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(src);
    });
    const max = 1400;
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

  async function postar() {
    if (!media) return;
    setError(null);
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirou.");

      let blob: Blob;
      let ext: string;
      let contentType: string;
      let duracaoMs: number | null = null;

      if (media.kind === "image") {
        blob = await compressToJpeg(media.file);
        ext = "jpg";
        contentType = "image/jpeg";
      } else {
        blob = media.file;
        ext = guessVideoExt(media.file.type, media.file.name);
        contentType = media.file.type || "video/mp4";
        duracaoMs = Math.round(media.duracaoMs);
      }

      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(path, blob, {
          contentType,
          upsert: false,
        });
      if (upErr) throw upErr;

      startTransition(async () => {
        const result = await registerStory(
          path,
          texto || null,
          media.kind === "video" ? "video" : "imagem",
          duracaoMs,
          eventoId,
        );
        if ("error" in result) {
          setError(result.error);
        } else {
          reset();
          router.refresh();
        }
        setUploading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
      setUploading(false);
    }
  }

  if (!media) {
    return (
      <div className="flex flex-col gap-3">
        {/* Card principal com ilustração */}
        <div
          className="relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-2"
          style={{
            aspectRatio: "4/5",
            background:
              "linear-gradient(160deg, rgba(212,175,110,0.12), rgba(212,175,110,0.02))",
            border: "1px dashed var(--gold-600)",
            color: "var(--gold-300)",
          }}
        >
          <span style={{ fontSize: 42 }}>✨</span>
          <div
            className="display"
            style={{ fontSize: 22, color: "var(--text-0)", fontWeight: 500 }}
          >
            Postar story
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-2)",
              maxWidth: 260,
              textAlign: "center",
              lineHeight: 1.4,
              padding: "0 20px",
            }}
          >
            24h no ar · só matches veem
          </div>
        </div>

        {/* 3 botões explícitos: browsers ficam confusos com capture +
            accept multi. Separar por mídia faz eles respeitarem. */}
        <div className="grid grid-cols-3 gap-2">
          <SourceButton
            icon="📷"
            label="Foto"
            accept="image/*"
            capture="environment"
            onPick={onPick}
          />
          <SourceButton
            icon="🎥"
            label="Vídeo"
            accept="video/*"
            capture="environment"
            onPick={onPick}
          />
          <SourceButton
            icon="🖼"
            label="Galeria"
            accept="image/*,video/*"
            onPick={onPick}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl px-3 py-2"
            style={{
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.3)",
              color: "var(--rose-400)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-1)", border: "1px solid var(--line-strong)" }}
    >
      <div className="relative" style={{ aspectRatio: "4/5" }}>
        {media.kind === "image" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={media.previewUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <video
            src={media.previewUrl}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
            autoPlay
            loop
            muted
            playsInline
          />
        )}
        {media.kind === "video" && (
          <div
            className="absolute mono"
            style={{
              top: 10,
              left: 10,
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              color: "var(--gold-300)",
              border: "1px solid var(--line-strong)",
              backdropFilter: "blur(6px)",
              letterSpacing: 1,
            }}
          >
            ▶ {Math.round(media.duracaoMs / 1000)}s
          </div>
        )}
        {texto && (
          <div
            className="absolute left-3 right-3"
            style={{
              bottom: 16,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              color: "#fff",
              padding: "9px 13px",
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {texto}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-3">
        <input
          className="input-field"
          placeholder="Legenda (opcional, 200 chars)"
          maxLength={200}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        {eventos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--text-3)",
              }}
            >
              Marcar evento (opcional)
            </div>
            {eventoSelecionado ? (
              <button
                type="button"
                onClick={() => setEventoId(null)}
                className="flex items-center gap-2"
                style={{
                  background: "rgba(212,175,110,0.15)",
                  border: "1px solid var(--gold-500)",
                  borderRadius: 12,
                  padding: "9px 12px",
                  color: "var(--gold-300)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span>📍</span>
                <span style={{ flex: 1 }}>
                  {eventoSelecionado.titulo}
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginLeft: 6,
                    }}
                  >
                    {eventoSelecionado.dataFmt}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                  }}
                >
                  trocar
                </span>
              </button>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {eventos.slice(0, 5).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEventoId(e.id)}
                    className="chip"
                    style={{
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "4px 10px",
                      maxWidth: "100%",
                    }}
                  >
                    📍 {e.titulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl px-3 py-2"
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
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1"
            onClick={reset}
            disabled={uploading}
            style={{ padding: 10 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-gold flex-1"
            onClick={postar}
            disabled={uploading}
            style={{ padding: 10 }}
          >
            {uploading ? "Postando…" : "Postar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceButton({
  icon,
  label,
  accept,
  capture,
  onPick,
}: {
  icon: string;
  label: string;
  accept: string;
  capture?: "environment" | "user";
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className="relative flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer"
      style={{
        padding: "14px 6px",
        background: "rgba(212,175,110,0.06)",
        border: "1px solid var(--line-strong)",
        color: "var(--text-1)",
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--gold-300)",
        }}
      >
        {label}
      </span>
      <input
        type="file"
        accept={accept}
        {...(capture ? { capture } : {})}
        onChange={onPick}
        aria-label={label}
        style={overlayInput}
      />
    </label>
  );
}

function obterDuracaoVideo(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const ms = v.duration * 1000;
      v.remove();
      resolve(ms);
    };
    v.onerror = () => reject(new Error("metadata_failed"));
    v.src = url;
  });
}

function guessVideoExt(mime: string, nome: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("webm")) return "webm";
  const fromName = nome.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 4) return fromName;
  return "mp4";
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)}MB`;
}
