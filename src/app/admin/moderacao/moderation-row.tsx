"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approveVerification, rejectVerification } from "./actions";

/* ====================================================================
 * ModerationRow — card por verificação pendente
 * - Carrega signed URL da selfie on-mount
 * - Botões "Aprovar" e "Rejeitar" (com textarea de motivo)
 * - Depois de action: router.refresh() pra atualizar fila
 * ================================================================== */

type Profile = {
  nome_exibicao: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string | null;
  estado: string | null;
  idade_1: number | null;
  idade_2: number | null;
  bio: string | null;
};

type Row = {
  id: string;
  profile_id: string;
  foto_url: string;
  created_at: string;
  profiles: Profile | null;
};

const MOTIVOS_SUGERIDOS = [
  "Rosto pouco visível",
  "Foto escura ou borrada",
  "Suspeita de foto de outra pessoa",
  "Foto com rosto coberto (óculos/máscara)",
];

export function ModerationRow({
  row,
  signedUrl,
}: {
  row: Row;
  signedUrl: string | null;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitApprove() {
    setError(null);
    const fd = new FormData();
    fd.append("id", row.id);
    startTransition(async () => {
      const res = await approveVerification(null, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function submitReject() {
    setError(null);
    if (!motivo.trim()) {
      setError("Escreva o motivo (o usuário vai ver).");
      return;
    }
    const fd = new FormData();
    fd.append("id", row.id);
    fd.append("motivo", motivo.trim());
    startTransition(async () => {
      const res = await rejectVerification(null, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const profile = row.profiles;
  const nome = profile?.nome_exibicao ?? "Perfil sem nome";
  const tipoLabel =
    profile?.tipo === "casal"
      ? "Casal"
      : profile?.tipo === "homem"
      ? "Homem solo"
      : profile?.tipo === "mulher"
      ? "Mulher solo"
      : "—";
  const idade =
    profile?.tipo === "casal"
      ? `${profile.idade_1 ?? "?"} & ${profile.idade_2 ?? "?"}`
      : profile?.idade_1 ?? "?";
  const cidade = profile?.cidade
    ? `${profile.cidade}${profile.estado ? ` · ${profile.estado}` : ""}`
    : "Sem cidade";
  const waiting = timeSince(row.created_at);

  return (
    <div
      className="card overflow-hidden"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      <div className="flex flex-col md:flex-row">
        {/* Thumb */}
        <div
          className="md:w-[240px] md:flex-shrink-0 relative"
          style={{
            aspectRatio: "1 / 1",
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={`Selfie de ${nome}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center text-center px-4"
              style={{ color: "var(--rose-400)", fontSize: 12 }}
            >
              Falha ao carregar selfie
            </div>
          )}
        </div>

        {/* Detalhes + ações */}
        <div className="flex-1 p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <Link
                href={`/admin/usuarios/${row.profile_id}`}
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--text-0)",
                  textDecoration: "none",
                  borderBottom: "1px dashed var(--line-strong)",
                }}
              >
                {nome} ↗
              </Link>
              <div
                style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}
              >
                {tipoLabel} · {idade} · {cidade}
              </div>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--gold-300)",
                padding: "4px 10px",
                border: "1px solid var(--line-strong)",
                borderRadius: 999,
                background: "rgba(212,175,110,0.06)",
              }}
            >
              {waiting}
            </span>
          </div>

          {profile?.bio && (
            <div
              className="text-sm"
              style={{
                color: "var(--text-1)",
                lineHeight: 1.5,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                border: "1px solid var(--line)",
              }}
            >
              {profile.bio}
            </div>
          )}

          {error && (
            <div
              className="text-sm"
              role="alert"
              style={{ color: "var(--rose-400)" }}
            >
              {error}
            </div>
          )}

          {!showReject ? (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={submitApprove}
                disabled={pending}
                className="btn-gold"
                style={{ padding: "10px 20px", fontSize: 14 }}
              >
                {pending ? "Aprovando…" : "✓ Aprovar"}
              </button>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={pending}
                className="btn-ghost"
                style={{ padding: "10px 20px", fontSize: 14 }}
              >
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                }}
              >
                Motivo (o usuário vê essa mensagem)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_SUGERIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(m)}
                    className="chip"
                    style={{ cursor: "pointer", fontSize: 11 }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ex: Não foi possível confirmar o rosto. Envie foto mais iluminada."
                className="input-field"
                style={{ resize: "none" }}
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={submitReject}
                  disabled={pending}
                  className="btn-gold"
                  style={{ padding: "10px 20px", fontSize: 14 }}
                >
                  {pending ? "Enviando…" : "Confirmar rejeição"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReject(false);
                    setMotivo("");
                    setError(null);
                  }}
                  className="btn-ghost"
                  style={{ padding: "10px 20px", fontSize: 14 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
