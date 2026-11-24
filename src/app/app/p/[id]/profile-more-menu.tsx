"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  bloquearPerfil,
  desbloquearPerfil,
  denunciarPerfil,
  type MotivoDenuncia,
} from "@/lib/moderacao/actions";

/* ====================================================================
 * ProfileMoreMenu — botão "..." no header de /app/p/[id] com:
 *  - Bloquear / Desbloquear
 *  - Denunciar (modal com motivos)
 * ================================================================== */

const MOTIVOS: { id: MotivoDenuncia; label: string }[] = [
  { id: "perfil_falso", label: "Perfil falso" },
  { id: "conteudo_inapropriado", label: "Conteúdo inapropriado" },
  { id: "assedio", label: "Assédio ou intimidação" },
  { id: "menor_de_idade", label: "Menor de idade" },
  { id: "outro", label: "Outro" },
];

export function ProfileMoreMenu({
  targetId,
  targetNome,
  jaBloqueado,
}: {
  targetId: string;
  targetNome: string;
  jaBloqueado: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [denunciaOpen, setDenunciaOpen] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDenuncia>("perfil_falso");
  const [detalhes, setDetalhes] = useState("");
  const [anexo, setAnexo] = useState<{ file: File; preview: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const anexoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Limpa preview ao desmontar
  useEffect(() => {
    return () => {
      if (anexo) URL.revokeObjectURL(anexo.preview);
    };
  }, [anexo]);

  function pickAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Anexe uma imagem (JPG ou PNG).");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Imagem muito grande (máx 10MB).");
      return;
    }
    setError(null);
    if (anexo) URL.revokeObjectURL(anexo.preview);
    setAnexo({ file: f, preview: URL.createObjectURL(f) });
  }

  function removerAnexo() {
    if (anexo) URL.revokeObjectURL(anexo.preview);
    setAnexo(null);
  }

  function handleBloquear() {
    if (jaBloqueado) {
      setOpen(false);
      startTransition(async () => {
        const r = await desbloquearPerfil(targetId);
        if ("error" in r) setError(r.error);
        else router.refresh();
      });
      return;
    }
    if (
      !confirm(
        `Bloquear ${targetNome}? Vocês não vão se ver no app até você desbloquear.`,
      )
    )
      return;
    setOpen(false);
    startTransition(async () => {
      const r = await bloquearPerfil(targetId);
      if ("error" in r) setError(r.error);
      else router.push("/app/descobrir");
    });
  }

  function handleDenunciar() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let anexoPath: string | null = null;
      if (anexo) {
        // Upload pro bucket privado denuncias-anexos
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Sessão expirou.");
          return;
        }
        const ext =
          anexo.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("denuncias-anexos")
          .upload(path, anexo.file, {
            contentType: anexo.file.type,
            upsert: false,
          });
        if (upErr) {
          setError(`Falha no upload: ${upErr.message}`);
          return;
        }
        anexoPath = path;
      }

      const r = await denunciarPerfil(targetId, motivo, detalhes, anexoPath);
      if ("error" in r) {
        setError(r.error);
        // Cleanup do anexo se a action falhou
        if (anexoPath) {
          const supabase = createClient();
          await supabase.storage
            .from("denuncias-anexos")
            .remove([anexoPath]);
        }
        return;
      }
      setSuccess("Denúncia enviada. Vamos revisar.");
      setDenunciaOpen(false);
      setDetalhes("");
      removerAnexo();
      window.setTimeout(() => setSuccess(null), 3000);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mais opções"
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        ⋯
      </button>

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
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 800,
            boxShadow: "0 10px 30px rgba(212,175,110,0.5)",
          }}
        >
          ✓ {success}
        </div>,
        document.body,
      )}

      {open && mounted && createPortal(
        <div
          onClick={() => setOpen(false)}
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
                setOpen(false);
                setDenunciaOpen(true);
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
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span>Denunciar</span>
            </button>
            <button
              type="button"
              onClick={handleBloquear}
              disabled={pending}
              className="flex items-center gap-3"
              style={{
                background: "var(--bg-2)",
                border: "1px solid rgba(217,138,114,0.3)",
                borderRadius: 14,
                padding: "14px 16px",
                color: "var(--rose-400)",
                fontSize: 15,
                cursor: pending ? "wait" : "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 20 }}>{jaBloqueado ? "🔓" : "🚫"}</span>
              <span>{jaBloqueado ? "Desbloquear" : "Bloquear"}</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
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

      {denunciaOpen && mounted && createPortal(
        <div
          onClick={() => setDenunciaOpen(false)}
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999, background: "rgba(0,0,0,0.75)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md flex flex-col"
            style={{
              background: "var(--bg-1)",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: "16px 18px calc(env(safe-area-inset-bottom) + 16px)",
              gap: 12,
              maxHeight: "92dvh",
              overflowY: "auto",
            }}
          >
            <div
              className="mx-auto"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "var(--line-strong)",
              }}
            />
            <div
              className="display"
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "var(--text-0)",
                textAlign: "center",
              }}
            >
              Denunciar {targetNome}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Sua denúncia é confidencial. Nossa moderação revisa em até 48h.
            </div>

            <div className="flex flex-col gap-1.5">
              {MOTIVOS.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background:
                      motivo === m.id
                        ? "rgba(212,175,110,0.12)"
                        : "var(--bg-2)",
                    border:
                      motivo === m.id
                        ? "1px solid var(--gold-500)"
                        : "1px solid var(--line)",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--text-0)",
                  }}
                >
                  <input
                    type="radio"
                    name="motivo"
                    value={m.id}
                    checked={motivo === m.id}
                    onChange={() => setMotivo(m.id)}
                    style={{ accentColor: "var(--gold-300)" }}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>

            <textarea
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value.slice(0, 1000))}
              placeholder="Detalhes (opcional)"
              rows={3}
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
                color: "var(--text-0)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
                resize: "vertical",
                outline: "none",
              }}
            />

            {/* Anexo (print de prova) */}
            {anexo ? (
              <div
                className="relative overflow-hidden"
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--gold-500)",
                  background: "#000",
                  aspectRatio: "16/9",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anexo.preview}
                  alt="Anexo"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: "contain" }}
                />
                <button
                  type="button"
                  onClick={removerAnexo}
                  aria-label="Remover anexo"
                  className="absolute"
                  style={{
                    top: 8,
                    right: 8,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.7)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontSize: 18,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => anexoInputRef.current?.click()}
                className="flex items-center gap-2"
                style={{
                  background: "var(--bg-2)",
                  border: "1px dashed var(--gold-600)",
                  color: "var(--gold-300)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 18 }}>📎</span>
                <span>Anexar print da prova (opcional)</span>
              </button>
            )}
            <input
              ref={anexoInputRef}
              type="file"
              accept="image/*"
              onChange={pickAnexo}
              style={{ display: "none" }}
            />

            {error && (
              <div
                role="alert"
                className="rounded-xl p-2.5"
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

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDenunciaOpen(false)}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDenunciar}
                disabled={pending}
                className="btn-gold flex-1"
                style={{ opacity: pending ? 0.7 : 1 }}
              >
                {pending ? "Enviando..." : "Enviar denúncia"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
