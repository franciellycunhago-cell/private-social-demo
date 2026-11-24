"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "./actions";

/* ====================================================================
 * PostForm — criar novo post (até 10 fotos + texto até 500 chars)
 *
 *  - Upload no client (mesmo padrão do PhotoUploader): comprime JPEG
 *    e envia pro bucket fotos-publicas em path determinístico
 *    `${userId}/posts/${timestamp}-${i}.jpg`.
 *  - Após todos os uploads, chama createPost(texto, paths) no servidor.
 *  - Em caso de erro, faz rollback dos arquivos enviados.
 * ================================================================== */

const MAX_FOTOS = 10;
const MAX_TEXTO = 500;
const MAX_DIM = 1600;

type Selecionada = {
  id: string;
  file: File;
  preview: string;
};

export function PostForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [fotos, setFotos] = useState<Selecionada[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const galeriaInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fotosRef = useRef<Selecionada[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);

  // Revoga blobs ao desmontar (evita memory leak se o user sair sem publicar)
  useEffect(() => {
    return () => {
      fotosRef.current.forEach((f) => URL.revokeObjectURL(f.preview));
    };
  }, []);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const restante = MAX_FOTOS - fotos.length;
    if (restante <= 0) {
      setError(`Máximo de ${MAX_FOTOS} fotos por post.`);
      return;
    }

    const filtered = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, restante);

    if (filtered.length === 0) {
      setError("Selecione imagens (JPG ou PNG).");
      return;
    }

    setError(null);
    const novas: Selecionada[] = filtered.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setFotos((atual) => [...atual, ...novas]);
  }

  function removerFoto(id: string) {
    setFotos((atual) => {
      const alvo = atual.find((f) => f.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return atual.filter((f) => f.id !== id);
    });
  }

  async function compressToJpeg(file: File, max: number): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    });
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
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

  async function publicar() {
    if (submitting) return;
    if (fotos.length === 0 && !texto.trim()) {
      setError("Adicione pelo menos uma foto ou um texto.");
      return;
    }
    setError(null);

    const supabase = createClient();
    const ts = Date.now();
    const enviados: string[] = [];

    try {
      for (let i = 0; i < fotos.length; i++) {
        const compressed = await compressToJpeg(fotos[i].file, MAX_DIM);
        const path = `${userId}/posts/${ts}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("fotos-publicas")
          .upload(path, compressed, {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (upErr) throw upErr;
        enviados.push(path);
      }
    } catch (err) {
      // Rollback dos enviados em caso de falha no upload
      if (enviados.length > 0) {
        await supabase.storage.from("fotos-publicas").remove(enviados);
      }
      setError(err instanceof Error ? err.message : "Falha ao enviar foto.");
      return;
    }

    startTransition(async () => {
      const result = await createPost(texto.trim(), enviados);
      if ("error" in result) {
        // Rollback storage se falhar no insert
        if (enviados.length > 0) {
          await supabase.storage.from("fotos-publicas").remove(enviados);
        }
        setError(result.error);
        return;
      }
      // Limpa previews e form, mantém o user na tela
      fotos.forEach((f) => URL.revokeObjectURL(f.preview));
      const qtdPosts = "ids" in result ? result.ids.length : 1;
      setFotos([]);
      setTexto("");
      setSuccess(
        qtdPosts === 1 ? "Publicado" : `${qtdPosts} posts publicados`,
      );
      window.setTimeout(() => setSuccess(null), 2800);
      router.refresh();
    });
  }

  const podeAdicionar = fotos.length < MAX_FOTOS;
  const podePublicar = (fotos.length > 0 || texto.trim().length > 0) && !submitting;

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <header
        className="flex items-center justify-between px-5"
        style={{
          paddingTop: 48,
          paddingBottom: 12,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link
          href="/app/descobrir"
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1.5,
            color: "var(--text-2)",
            textDecoration: "none",
          }}
        >
          Cancelar
        </Link>
        <div
          className="display"
          style={{ fontSize: 16, fontWeight: 500, color: "var(--text-0)" }}
        >
          Novo post
        </div>
        <button
          type="button"
          onClick={publicar}
          disabled={!podePublicar}
          className="mono"
          style={{
            background: podePublicar ? "var(--shine-gold)" : "transparent",
            color: podePublicar ? "#1a0f05" : "var(--text-3)",
            border: podePublicar ? "none" : "1px solid var(--line)",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 700,
            cursor: podePublicar ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Enviando..." : "Publicar"}
        </button>
      </header>

      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
            placeholder="Conta uma novidade, um pensamento, um convite..."
            rows={4}
            disabled={submitting}
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "12px 14px",
              color: "var(--text-0)",
              fontSize: 14,
              fontFamily: "var(--font-ui)",
              resize: "vertical",
              minHeight: 100,
              outline: "none",
            }}
          />
          <div
            className="flex justify-end mono"
            style={{ fontSize: 10, color: "var(--text-3)" }}
          >
            {texto.length} / {MAX_TEXTO}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div
            className="flex items-center justify-between mono"
            style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}
          >
            <span style={{ color: "var(--text-2)" }}>Fotos</span>
            <span style={{ color: "var(--text-3)" }}>
              {fotos.length} / {MAX_FOTOS}
            </span>
          </div>
          {fotos.length > 1 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--gold-300)",
                lineHeight: 1.4,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(212,175,110,0.08)",
                border: "1px solid var(--gold-600)",
              }}
            >
              ✦ Cada foto vira um post separado. O texto abaixo vai só no
              primeiro.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f) => (
              <div
                key={f.id}
                className="relative overflow-hidden"
                style={{
                  aspectRatio: "1/1",
                  borderRadius: 12,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.preview}
                  alt=""
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "cover" }}
                />
                <button
                  type="button"
                  onClick={() => removerFoto(f.id)}
                  aria-label="Remover foto"
                  disabled={submitting}
                  className="absolute top-1.5 right-1.5 flex items-center justify-center"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.65)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 16,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {podeAdicionar && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={submitting}
                className="relative flex flex-col items-center justify-center"
                style={{
                  aspectRatio: "1/1",
                  borderRadius: 12,
                  background: "rgba(212,175,110,0.05)",
                  border: "1px dashed var(--gold-600)",
                  color: "var(--gold-300)",
                  cursor: submitting ? "wait" : "pointer",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>＋</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  Adicionar
                </span>
              </button>
            )}
          </div>

          <input
            ref={galeriaInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            disabled={submitting}
            style={{ display: "none" }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickFiles}
            disabled={submitting}
            style={{ display: "none" }}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl p-3"
            style={{
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.3)",
              color: "var(--rose-400)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {success && mounted && createPortal(
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 mono"
          style={{
            top: "calc(env(safe-area-inset-top) + 14px)",
            zIndex: 99999,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            padding: "10px 22px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 800,
            boxShadow: "0 10px 30px rgba(212,175,110,0.5)",
            animation: "toastSlide 0.25s ease",
          }}
        >
          ✓ {success}
        </div>,
        document.body,
      )}
      <style jsx global>{`
        @keyframes toastSlide {
          from {
            transform: translate(-50%, -20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>

      {pickerOpen && mounted && createPortal(
        <div
          onClick={() => setPickerOpen(false)}
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999, background: "rgba(0,0,0,0.65)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md flex flex-col"
            style={{
              background: "var(--bg-1)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: "12px 14px calc(env(safe-area-inset-bottom) + 14px)",
              gap: 8,
            }}
          >
            <div
              className="mx-auto"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "var(--line-strong)",
                marginBottom: 6,
              }}
            />
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                cameraInputRef.current?.click();
              }}
              className="flex items-center gap-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "14px 16px",
                color: "var(--text-0)",
                fontSize: 15,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>📷</span>
              <span>Tirar foto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                galeriaInputRef.current?.click();
              }}
              className="flex items-center gap-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "14px 16px",
                color: "var(--text-0)",
                fontSize: 15,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>🖼</span>
              <span>Escolher da galeria</span>
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mono"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-3)",
                padding: "10px 0 4px",
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
