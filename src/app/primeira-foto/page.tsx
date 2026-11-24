import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus, routeForStatus } from "@/lib/supabase/profile";
import { getFotoObrigatoria } from "@/lib/app-settings/server";
import { MIN_FOTOS } from "@/lib/foto-grace";
import { countUserContentFotos } from "@/lib/foto-grace-server";
import { UploadForm } from "./upload-form";

export const metadata = {
  title: "Complete seu perfil — PrivateSocial",
};

/* ====================================================================
 * /primeira-foto
 *
 * Tela de enforcement do grace period de fotos: usuários que passaram
 * dos 5 dias sem postar o mínimo de fotos chegam aqui via /app/layout
 * e ficam travados até completar.
 *
 * Mostra contador X / MIN_FOTOS, fotos já enviadas, e o uploader pra
 * adicionar mais. Quando bate o mínimo, redireciona pro /app.
 * ================================================================== */

export default async function PrimeiraFotoPage() {
  const info = await getProfileStatus();
  if (!info) redirect("/login");
  if (info.status.state !== "aprovado") {
    redirect(routeForStatus(info.status.state));
  }

  const supabase = await createClient();
  const fotoObrigatoria = await getFotoObrigatoria();

  // Conta TOTAL de conteúdo com foto (perfil + posts). Se já bateu o
  // mínimo OU a flag foi desligada, manda direto pro app.
  const totalConteudo = await countUserContentFotos(supabase, info.userId);
  if (totalConteudo >= MIN_FOTOS || !fotoObrigatoria) {
    redirect("/app");
  }

  // Pega só as fotos do perfil pra mostrar como thumbs (não tenta
  // renderizar fotos de posts pra simplificar a UI).
  const { data: fotos } = await supabase
    .from("fotos")
    .select("id, url, ordem")
    .eq("profile_id", info.userId)
    .eq("tipo", "publica")
    .is("deletado_em", null)
    .order("ordem", { ascending: true });

  const fotosAtuais = (fotos ?? []) as Array<{
    id: string;
    url: string;
    ordem: number;
  }>;
  const postsComFotoCount = totalConteudo - fotosAtuais.length;

  // Resolve URLs públicas das fotos do perfil pra mostrar como
  // miniaturas no progresso.
  const thumbs = fotosAtuais.map((f) => {
    const { data } = supabase.storage
      .from("fotos-publicas")
      .getPublicUrl(f.url);
    return { id: f.id, src: data.publicUrl };
  });

  const restam = MIN_FOTOS - totalConteudo;

  return (
    <div
      className="relative flex flex-col items-center justify-center px-6 pt-10 pb-10"
      style={{ minHeight: "100dvh" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 0%, #221410 0%, #0a0706 55%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-5 text-center">
        <div style={{ fontSize: 44 }}>📸</div>

        <div className="flex flex-col gap-2">
          <h1
            className="display gold-text"
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            Complete seu perfil
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-1)",
              lineHeight: 1.5,
            }}
          >
            Pra continuar usando o app você precisa de pelo menos{" "}
            <strong style={{ color: "var(--gold-300)" }}>
              {MIN_FOTOS} publicações
            </strong>
            . Cada foto enviada vira uma publicação automaticamente.
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              lineHeight: 1.5,
            }}
          >
            Perfis com pouco conteúdo passam impressão de fake. A primeira
            foto enviada também vira sua capa (você pode trocar depois pelo
            lápis no perfil). Tudo com watermark de proteção.
          </p>
        </div>

        {/* Progress: X / MIN_FOTOS com miniaturas das fotos já enviadas */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(212,175,110,0.06)",
            border: "1px solid var(--gold-600)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            Progresso
          </div>
          <div
            className="flex items-center justify-center gap-2"
            style={{ marginBottom: 8 }}
          >
            {Array.from({ length: MIN_FOTOS }).map((_, i) => {
              const thumb = thumbs[i];
              return (
                <div
                  key={i}
                  className="relative overflow-hidden"
                  style={{
                    width: 56,
                    height: 70,
                    borderRadius: 10,
                    background: thumb ? "var(--bg-2)" : "transparent",
                    border: thumb
                      ? "2px solid var(--gold-500)"
                      : "2px dashed rgba(212,175,110,0.35)",
                  }}
                >
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb.src}
                      alt=""
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        color: "rgba(212,175,110,0.5)",
                        fontSize: 22,
                      }}
                    >
                      +
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-1)" }}>
            <strong style={{ color: "var(--gold-300)" }}>
              {totalConteudo}
            </strong>{" "}
            de {MIN_FOTOS} conteúdos ·{" "}
            <span style={{ color: "var(--text-2)" }}>
              {restam === 1 ? "falta 1" : `faltam ${restam}`}
            </span>
          </div>
          {postsComFotoCount > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {fotosAtuais.length} foto
              {fotosAtuais.length === 1 ? "" : "s"} no perfil +{" "}
              {postsComFotoCount} publica
              {postsComFotoCount === 1 ? "ção" : "ções"} com foto
            </div>
          )}
        </div>

        <UploadForm />

        <div
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginTop: 4,
          }}
        >
          Watermark aplicado automaticamente
        </div>
      </div>
    </div>
  );
}
