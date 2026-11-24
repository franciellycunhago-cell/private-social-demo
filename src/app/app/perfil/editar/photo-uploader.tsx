"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deletePhoto, registerPhoto, reorderPhotos } from "./actions";
import { ComentariosDrawer } from "../../p/[id]/comentarios-drawer";
import { PhotoLikesDrawer } from "../../p/[id]/photo-likes-drawer";
import type { FotoComSrc } from "@/lib/supabase/fotos";

const hiddenInput: React.CSSProperties = {
  position: "fixed",
  top: "-9999px",
  left: "-9999px",
  width: "1px",
  height: "1px",
  opacity: 0,
};

type Props = {
  tipo: "publica" | "privada";
  /** Se omitido, sem limite (ilimitado). */
  limite?: number;
  fotos: FotoComSrc[];
};

export function PhotoUploader({ tipo, limite, fotos }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ── Comentários ─────────────────────────────────────────────────────
  const [comentandoFoto, setComentandoFoto] = useState<FotoComSrc | null>(null);

  // ── Quem curtiu (lista) ────────────────────────────────────────────
  const [likersFotoId, setLikersFotoId] = useState<string | null>(null);

  // ── Drag-to-reorder ─────────────────────────────────────────────────
  const [localFotos, setLocalFotos] = useState<FotoComSrc[]>(fotos);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  // Quando o user reordena, guardamos a "ordem esperada" pra que o useEffect
  // não reverta o estado otimista quando o servidor ainda não devolveu os
  // dados atualizados. Só sincroniza quando o servidor confirmar a ordem.
  const expectedOrderRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (expectedOrderRef.current) {
      const incomingIds = fotos.map((f) => f.id);
      const expected = expectedOrderRef.current;
      const matches =
        incomingIds.length === expected.length &&
        incomingIds.every((id, i) => id === expected[i]);
      if (matches) {
        // Servidor confirmou — sincroniza e limpa o ref
        expectedOrderRef.current = null;
        setLocalFotos(fotos);
      }
      // Se não bate (servidor ainda velho ou update falhou), mantém estado local
      return;
    }
    setLocalFotos(fotos);
  }, [fotos]);

  function applyReorder(next: FotoComSrc[]) {
    setLocalFotos(next);
    const expectedIds = next.map((f) => f.id);
    expectedOrderRef.current = expectedIds;
    setError(null);
    startTransition(async () => {
      const result = await reorderPhotos(
        next.map((f, idx) => ({ id: f.id, ordem: idx })),
      );
      if ("error" in result) {
        // Falhou — limpa o ref, mostra erro e reverte para a ordem do servidor
        expectedOrderRef.current = null;
        setError(result.error);
        setLocalFotos(fotos);
      } else {
        // Sucesso — força o servidor a reentregar dados frescos
        router.refresh();
      }
    });
  }

  function handleDragStart(e: React.DragEvent, i: number) {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = "move";
    // Pequeno delay para que o ghost do browser apareça antes de esconder o original
    setTimeout(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.35";
    }, 0);
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (i !== overIdx) setOverIdx(i);
  }

  function handleDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return finish();
    const next = [...localFotos];
    const [item] = next.splice(dragIdx, 1);
    next.splice(i, 0, item);
    finish();
    applyReorder(next);
  }

  function handleDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = "";
    finish();
  }

  function finish() {
    setDragIdx(null);
    setOverIdx(null);
  }

  // ── Upload ───────────────────────────────────────────────────────────
  const bucket = tipo === "publica" ? "fotos-publicas" : "fotos-privadas";
  const maxDim = tipo === "publica" ? 1600 : 1200;
  const cheio = limite !== undefined && localFotos.length >= limite;

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

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Envie uma imagem (JPG ou PNG)."); return; }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirou. Faça login de novo.");
      const compressed = await compressToJpeg(f, maxDim);
      const path = `${user.id}/${tipo}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, compressed, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const fd = new FormData();
      fd.append("path", path);
      fd.append("tipo", tipo);
      startTransition(async () => {
        const result = await registerPhoto(null, fd);
        if (result?.error) setError(result.error);
        else router.refresh();
        setUploading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar a foto.");
      setUploading(false);
    }
  }

  function onDelete(id: string) {
    setError(null);
    const fd = new FormData();
    fd.append("id", id);
    startTransition(async () => {
      const result = await deletePhoto(null, fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <ComentariosDrawer
        fotoId={comentandoFoto?.id ?? ""}
        fotoPreview={comentandoFoto?.src ?? null}
        open={!!comentandoFoto}
        onClose={() => setComentandoFoto(null)}
      />
      <PhotoLikesDrawer
        fotoId={likersFotoId ?? ""}
        open={!!likersFotoId}
        onClose={() => setLikersFotoId(null)}
      />

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {localFotos.map((foto, i) => (
            <div
              key={foto.id}
              ref={i === dragIdx ? dragNode : null}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className="relative overflow-hidden"
              style={{
                aspectRatio: "3/4",
                borderRadius: 14,
                background: "var(--bg-2)",
                border: overIdx === i && dragIdx !== i
                  ? "2px solid var(--gold-400)"
                  : "1px solid var(--line)",
                transition: "border 0.15s",
                cursor: "grab",
              }}
            >
              {/* Fallback "Indisponível" sempre presente atrás da img.
                  Quando a img carrega com sucesso, fica oculta atrás dela.
                  Quando a img falha (arquivo perdido), o onError esconde a
                  img e o fallback aparece. */}
              <div
                className="absolute inset-0"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-3)",
                  fontSize: 11,
                  gap: 4,
                  textAlign: "center",
                  padding: 8,
                  pointerEvents: "none",
                }}
              >
                <span>Foto indisponível</span>
                <span style={{ fontSize: 9 }}>toque no × pra remover</span>
              </div>
              {foto.src && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.src}
                    alt=""
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: "cover", pointerEvents: "none" }}
                    onError={(e) => {
                      // Arquivo perdido no storage → esconde a img,
                      // o fallback que está atrás aparece sozinho
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Clique para ver comentários */}
                  <button
                    type="button"
                    onClick={() => setComentandoFoto(foto)}
                    aria-label="Ver comentários"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  />
                </>
              )}

              {/* Botão deletar */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(foto.id); }}
                aria-label="Remover foto"
                disabled={pending}
                className="absolute top-1.5 right-1.5 flex items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontSize: 16,
                  cursor: pending ? "progress" : "pointer",
                  zIndex: 2,
                }}
              >
                ×
              </button>

              {/* Chip "♥ N" — só aparece se tiver curtidas. Click abre
                  drawer com quem curtiu. */}
              {(foto.likes_count ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLikersFotoId(foto.id);
                  }}
                  aria-label="Ver quem curtiu"
                  className="absolute flex items-center gap-1"
                  style={{
                    bottom: 6,
                    right: 6,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(6px)",
                    color: "#fff",
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontSize: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    zIndex: 3,
                  }}
                >
                  <span style={{ color: "#ff4c6b" }}>♥</span>
                  <span>{foto.likes_count}</span>
                </button>
              )}

              {/* Badge "capa" na primeira foto pública */}
              {tipo === "publica" && i === 0 && (
                <div
                  className="absolute bottom-1.5 left-1.5 mono"
                  style={{
                    fontSize: 8,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    background: "var(--shine-gold)",
                    color: "#1a0f05",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontWeight: 700,
                    zIndex: 2,
                  }}
                >
                  Capa
                </div>
              )}

              {/* Botão "definir como capa" nas demais fotos públicas */}
              {tipo === "publica" && i > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = [...localFotos];
                    const [item] = next.splice(i, 1);
                    next.unshift(item);
                    applyReorder(next);
                  }}
                  aria-label="Definir como capa"
                  className="absolute mono"
                  disabled={pending}
                  style={{
                    bottom: 6,
                    left: 6,
                    background: "rgba(0,0,0,0.65)",
                    backdropFilter: "blur(6px)",
                    color: "var(--gold-300)",
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontSize: 9,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: pending ? "progress" : "pointer",
                    zIndex: 3,
                  }}
                >
                  ★ Capa
                </button>
              )}
            </div>
          ))}

          {!cheio && (
            <label
              htmlFor={`photo-input-${tipo}`}
              className="flex flex-col items-center justify-center"
              style={{
                aspectRatio: "3/4",
                borderRadius: 14,
                background: "rgba(212,175,110,0.05)",
                border: "1px dashed var(--gold-600)",
                color: "var(--gold-300)",
                gap: 6,
                opacity: uploading || pending ? 0.5 : 1,
                cursor: uploading || pending ? "progress" : "pointer",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>
                {uploading ? "Enviando" : "Adicionar"}
              </span>
            </label>
          )}
          <input
            id={`photo-input-${tipo}`}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={uploading || pending}
            style={hiddenInput}
          />
        </div>

        <div className="flex justify-between" style={{ fontSize: 11, color: "var(--text-2)" }}>
          <span>
            {localFotos.length}
            {limite !== undefined ? ` / ${limite}` : ""} foto
            {localFotos.length === 1 ? "" : "s"}
          </span>
          <span style={{ color: "var(--text-3)" }}>
            {localFotos.length > 1 ? "segure e arraste para reordenar" : ""}
          </span>
        </div>

        {error && (
          <div
            className="rounded-xl p-3"
            style={{
              background: "rgba(217,138,114,0.08)",
              border: "1px solid rgba(217,138,114,0.3)",
              color: "var(--rose-400)",
              fontSize: 13,
            }}
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    </>
  );
}
