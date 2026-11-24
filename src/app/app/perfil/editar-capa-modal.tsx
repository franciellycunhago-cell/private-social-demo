"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setFotoCapa } from "./editar/actions";

/* ====================================================================
 * EditarCapaModal — modal pra trocar a foto de capa do perfil.
 *
 * Duas formas:
 *  1. Escolher de fotos existentes (de posts do user)
 *  2. Fazer upload novo (só pra capa, não vira post)
 * ================================================================== */

type FotoOpcao = {
  path: string;
  src: string;
};

export function EditarCapaModal({
  open,
  onClose,
  opcoes,
  capaAtualPath,
}: {
  open: boolean;
  onClose: () => void;
  /** Fotos já existentes em posts do user (paths + URLs públicas) */
  opcoes: FotoOpcao[];
  /** Path da capa atual (pra destacar visualmente) */
  capaAtualPath: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending && !uploading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, uploading, onClose]);

  if (!open) return null;

  async function compressToJpeg(file: File, maxDim = 1600): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    });
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
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
        0.88,
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
      const path = `${user.id}/capa-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("fotos-publicas")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      // Aplica a nova capa
      const r = await setFotoCapa(path);
      if ("error" in r) {
        setError(r.error);
        setUploading(false);
        return;
      }
      setUploading(false);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar.");
      setUploading(false);
    }
  }

  function pickExistente(path: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const r = await setFotoCapa(path);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const busy = uploading || pending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--bg-1)",
          border: "1px solid var(--gold-600)",
          borderRadius: 18,
          padding: 22,
          color: "var(--text-0)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div
            className="display"
            style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Trocar foto de capa
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-3)",
              fontSize: 22,
              cursor: busy ? "default" : "pointer",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          Escolha uma foto que você já postou ou envie uma nova exclusiva
          pra capa.
        </div>

        {/* Upload de nova foto */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="btn-gold"
          style={{
            padding: "12px 16px",
            width: "100%",
            cursor: busy ? "progress" : "pointer",
            opacity: busy ? 0.7 : 1,
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          {uploading ? "Enviando…" : "📤 Enviar nova foto"}
        </button>
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

        {/* Grid de fotos de posts */}
        {opcoes.length > 0 ? (
          <>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--text-3)",
                marginBottom: 8,
              }}
            >
              Ou escolha das suas publicações
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {opcoes.map((opt) => {
                const ativo = opt.path === capaAtualPath;
                return (
                  <button
                    key={opt.path}
                    type="button"
                    onClick={() => pickExistente(opt.path)}
                    disabled={busy}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "var(--bg-2)",
                      border: ativo
                        ? "2px solid var(--gold-400)"
                        : "1px solid var(--line)",
                      cursor: busy ? "default" : "pointer",
                      padding: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={opt.src}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    {ativo && (
                      <div
                        className="absolute"
                        style={{
                          top: 4,
                          right: 4,
                          background: "var(--shine-gold)",
                          color: "#1a0f05",
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 999,
                          letterSpacing: 0.5,
                        }}
                      >
                        ATUAL
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              textAlign: "center",
              padding: "20px 12px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 12,
              border: "1px dashed var(--line)",
              lineHeight: 1.5,
            }}
          >
            Você ainda não tem fotos em publicações. Use o botão acima pra
            enviar uma foto exclusiva pra capa.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              padding: "10px 14px",
              borderRadius: 10,
              marginTop: 14,
              background: "rgba(217,138,114,0.12)",
              border: "1px solid rgba(217,138,114,0.4)",
              color: "var(--rose-400)",
              lineHeight: 1.4,
            }}
          >
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}
