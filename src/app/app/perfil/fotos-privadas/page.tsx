import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { listPhotosForProfile } from "@/lib/supabase/fotos";
import { PhotoUploader } from "../editar/photo-uploader";

export const metadata = { title: "Fotos privadas — PrivateSocial" };

export default async function FotosPrivadasPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const p = info.status.profile;

  const fotos = await listPhotosForProfile(p.id);
  const privadas = fotos.filter((f) => f.tipo === "privada");

  return (
    <div className="flex flex-col px-5 pt-10 pb-10 gap-6">
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
          <h1 className="display" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>
            Fotos privadas
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Liberadas só quando você aprova um pedido de acesso.
          </p>
        </div>
      </header>

      <div
        className="rounded-2xl p-4 flex gap-3 items-start"
        style={{ background: "rgba(212,175,110,0.06)", border: "1px solid var(--line)" }}
      >
        <span style={{ fontSize: 16 }}>🔒</span>
        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--gold-300)" }}>
            Suba quantas fotos quiser.
          </strong>{" "}
          Ninguém vê nada por padrão — cada pessoa precisa pedir acesso e
          você aprova manualmente em{" "}
          <Link
            href="/app/perfil/pedidos"
            style={{ color: "var(--gold-300)", textDecoration: "underline" }}
          >
            Pedidos de privado
          </Link>
          . Você revoga quando quiser.
        </div>
      </div>

      <PhotoUploader tipo="privada" fotos={privadas} />
    </div>
  );
}
