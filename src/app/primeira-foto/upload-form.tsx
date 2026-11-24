"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerFirstPhoto } from "./actions";

/* ====================================================================
 * UploadForm — envia a primeira foto pública.
 * Reaproveita o mesmo fluxo do PhotoUploader (compress → upload →
 * registerPhoto), mas simplificado pra esse onboarding.
 * ================================================================== */

const MAX_DIM = 1600;

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
        "image/jpeg",
        0.85,
      );
    });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Envie uma imagem (JPG ou PNG).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirou. Faça login.");
      const compressed = await compressToJpeg(f);
      const path = `${user.id}/publica-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("fotos-publicas")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      const fd = new FormData();
      fd.append("path", path);
      startTransition(async () => {
        const result = await registerFirstPhoto(null, fd);
        if (result?.error) {
          setError(result.error);
          setUploading(false);
        } else {
          // Refresh atualiza o contador. Se bateu o mínimo, a própria
          // page.tsx redireciona pro /app.
          setUploading(false);
          router.refresh();
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="btn-gold"
        style={{
          padding: 14,
          textAlign: "center",
          cursor: busy ? "progress" : "pointer",
          opacity: busy ? 0.7 : 1,
          width: "100%",
        }}
      >
        {busy ? "Enviando…" : "Escolher foto"}
      </button>
      {/* display:none bloqueia o file picker no Android WebView/PWA.
          Mantemos o input renderizado mas invisível e fora da tela. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
        }}
      />
      {error && (
        <div
          role="alert"
          className="rounded-xl p-3"
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
    </div>
  );
}
