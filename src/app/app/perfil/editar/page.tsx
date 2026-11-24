import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { resolveFotoCapa } from "@/lib/foto-capa";
import { loadPostsByProfile } from "@/lib/posts/server";
import { EditProfileForm } from "./form";
import { CapaEditavel } from "../capa-editavel";

export const metadata = {
  title: "Editar perfil — PrivateSocial",
};

export default async function EditarPerfilPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const p = info.status.profile;

  const supabase = await createClient();

  // Carrega capa atual + opções (fotos dos posts do user) pro modal
  const [capa, meusPosts] = await Promise.all([
    resolveFotoCapa(supabase, p.id, p.foto_capa_path),
    loadPostsByProfile(p.id, p.id),
  ]);

  // Extrai os paths das fotos dos posts pra o modal
  const opcoesCapa: { path: string; src: string }[] = [];
  const seenPaths = new Set<string>();
  meusPosts.forEach((post) => {
    post.fotos.forEach((f) => {
      const match = f.src.match(/\/fotos-publicas\/(.+?)(?:\?|$)/);
      const path = match?.[1];
      if (path && !seenPaths.has(path)) {
        seenPaths.add(path);
        opcoesCapa.push({ path, src: f.src });
      }
    });
  });

  return (
    <div className="flex flex-col gap-6 px-5 pt-10 pb-10">
      <header className="flex items-center gap-3">
        <Link
          href="/app/perfil"
          aria-label="Voltar"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            color: "var(--text-1)",
            textDecoration: "none",
          }}
        >
          ‹
        </Link>
        <div className="flex-1">
          <h1
            className="display"
            style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            Editar perfil
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Informações que aparecem no seu perfil público.
          </p>
        </div>
      </header>

      {/* Foto de perfil — mesmo componente da tela /app/perfil, menor */}
      <section
        className="rounded-2xl p-5 flex flex-col items-center"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 14,
            alignSelf: "flex-start",
          }}
        >
          Foto de perfil
        </div>
        <CapaEditavel
          capaUrl={capa}
          nome={p.nome_exibicao ?? "Você"}
          opcoes={opcoesCapa}
          capaAtualPath={p.foto_capa_path}
          size={140}
        />
      </section>

      <EditProfileForm initial={p} />
    </div>
  );
}
