import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PostForm } from "./post-form";

export const metadata = {
  title: "Novo post — PrivateSocial",
};

/* ====================================================================
 * /app/post/novo
 *
 * Tela de criação de post (foto + caption).
 *  - Bloqueia se não verificado (RLS já bloqueia, mas damos UX antes)
 *  - PostForm faz upload no client + chama createPost no submit
 * ================================================================== */

export default async function NovoPostPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");

  if (!info.status.profile.verificado) {
    return (
      <div className="px-5" style={{ paddingTop: 48 }}>
        <Link
          href="/app/descobrir"
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1.5,
            color: "var(--text-3)",
            textDecoration: "none",
          }}
        >
          ← Voltar
        </Link>
        <div
          className="card mt-6 flex flex-col items-center text-center gap-3"
          style={{ padding: 32 }}
        >
          <div
            className="display gold-text"
            style={{ fontSize: 22, fontWeight: 500 }}
          >
            Verificação obrigatória
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
              maxWidth: 280,
            }}
          >
            Só perfis verificados podem postar no feed. Confira sua verificação
            antes de publicar.
          </div>
          <Link
            href="/app/perfil"
            className="btn-gold mt-2"
            style={{ textDecoration: "none" }}
          >
            Ver meu perfil
          </Link>
        </div>
      </div>
    );
  }

  return <PostForm userId={info.userId} />;
}
