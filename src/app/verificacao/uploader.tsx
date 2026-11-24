"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerVerification } from "./actions";

/* ====================================================================
 * SelfieUploader
 * - Captura foto via <input capture="user"> dentro de um <label>
 *   (click no label dispara nativamente, sem precisar de .click()
 *   programático — funciona em Chrome Mobile, iOS Safari, etc.)
 * - Preview em canvas comprimido pra JPEG 1200px (evita 5MB)
 * - Upload direto pro bucket `verificacoes` (privado; policy permite
 *   user fazer insert no próprio path e só admin ler)
 * - Chama registerVerification(path) pra criar a linha em `verificacoes`
 * ================================================================== */

type Phase =
  | { kind: "idle" }
  | { kind: "preview"; file: File; previewUrl: string }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

/**
 * Input file transparente cobrindo 100% do label. Padrão mais robusto que
 * o truque sr-only (clip: rect(0,0,0,0)) — este quebrava em webviews e
 * browsers Android/MIUI que bloqueiam click em elementos sem área de hit.
 * Aqui o usuário literalmente toca o input (invisível), não o label.
 */
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

export function SelfieUploader() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setPhase({ kind: "error", message: "Envie uma imagem (JPG ou PNG)." });
      return;
    }
    const previewUrl = URL.createObjectURL(f);
    setPhase({ kind: "preview", file: f, previewUrl });
  }

  function resetPicker() {
    if (phase.kind === "preview") URL.revokeObjectURL(phase.previewUrl);
    if (fileInput.current) fileInput.current.value = "";
    setPhase({ kind: "idle" });
  }

  async function compressToJpeg(file: File): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    });
    const max = 1200;
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

  async function upload() {
    if (phase.kind !== "preview") return;
    const file = phase.file;
    setPhase({ kind: "uploading" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirou. Faça login de novo.");

      const compressed = await compressToJpeg(file);
      const path = `${user.id}/selfie-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("verificacoes")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      const fd = new FormData();
      fd.append("path", path);

      startTransition(async () => {
        const result = await registerVerification(null, fd);
        if (result?.error) {
          setPhase({ kind: "error", message: result.error });
          return;
        }
        // sucesso — recarrega a página pra mostrar estado "pendente"
        router.refresh();
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao enviar a selfie.";
      setPhase({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {phase.kind === "idle" && (
        <>
          <label
            className="btn-gold relative w-full flex items-center justify-center gap-2 cursor-pointer"
            style={{ padding: 16 }}
          >
            <CameraIcon />
            Tirar selfie agora
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="user"
              onChange={onFileChange}
              style={overlayInput}
            />
          </label>
          <label
            className="relative w-full flex items-center justify-center gap-2 cursor-pointer mt-1"
            style={{
              padding: "10px 16px",
              fontSize: 13,
              color: "var(--text-2)",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textDecorationColor: "var(--line-strong)",
            }}
          >
            ou envie uma foto existente
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              style={overlayInput}
            />
          </label>
        </>
      )}

      {phase.kind === "preview" && (
        <div className="flex flex-col gap-3">
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--line-strong)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={phase.previewUrl}
              alt="Sua selfie"
              className="block w-full"
              style={{ maxHeight: 420, objectFit: "cover" }}
            />
          </div>
          <button
            type="button"
            onClick={upload}
            className="btn-gold w-full"
            style={{ padding: 16 }}
          >
            Enviar esta foto
          </button>
          <button
            type="button"
            onClick={resetPicker}
            className="btn-ghost w-full"
          >
            Tirar outra
          </button>
        </div>
      )}

      {(phase.kind === "uploading" || pending) && (
        <div
          className="p-4 rounded-2xl text-center mono"
          style={{
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--gold-300)",
            background: "rgba(212,175,110,0.08)",
            border: "1px solid var(--line-strong)",
          }}
        >
          Enviando selfie…
        </div>
      )}

      {phase.kind === "error" && (
        <>
          <div
            className="p-3 rounded-xl"
            style={{
              background: "rgba(217, 138, 114, 0.08)",
              border: "1px solid rgba(217, 138, 114, 0.3)",
              color: "var(--rose-400)",
              fontSize: 13,
            }}
            role="alert"
          >
            {phase.message}
          </div>
          <button
            type="button"
            onClick={resetPicker}
            className="btn-ghost w-full"
          >
            Tentar de novo
          </button>
        </>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
