import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PageHeading } from "@/components/page-heading";
import { BloqueadoRow, type BloqueadoItem } from "./bloqueado-row";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Bloqueados — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/bloqueados
 *
 * Lista os perfis que EU bloqueei (de_id = me). Cada linha tem botão
 * Desbloquear. Não mostra perfis que me bloquearam (esses ficam
 * invisíveis pra mim por design).
 * ================================================================== */

export default async function BloqueadosPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const admin = adminClient();

  const { data: bloqueiosRaw } = await admin
    .from("bloqueios")
    .select("para_id, created_at")
    .eq("de_id", meId)
    .order("created_at", { ascending: false });

  const rows = (bloqueiosRaw ?? []) as { para_id: string; created_at: string }[];

  let itens: BloqueadoItem[] = [];
  if (rows.length > 0) {
    const ids = rows.map((r) => r.para_id);
    const [profilesRes, fotosRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, nome_exibicao, handle, cidade, estado")
        .in("id", ids),
      admin
        .from("fotos")
        .select("profile_id, url")
        .in("profile_id", ids)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);

    const capaMap = new Map<string, string>();
    (fotosRes.data ?? []).forEach((f) => {
      const pid = f.profile_id as string;
      if (!capaMap.has(pid)) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url as string);
        capaMap.set(pid, data.publicUrl);
      }
    });

    const profMap = new Map<
      string,
      { nome: string; handle: string | null; cidade: string }
    >();
    (profilesRes.data ?? []).forEach((p) => {
      profMap.set(p.id as string, {
        nome: (p.nome_exibicao as string) ?? "Perfil",
        handle: (p.handle as string) ?? null,
        cidade: [p.cidade, p.estado].filter(Boolean).join(", "),
      });
    });

    itens = rows.map((r) => {
      const pInfo = profMap.get(r.para_id);
      return {
        id: r.para_id,
        nome: pInfo?.nome ?? "Perfil",
        handle: pInfo?.handle ?? null,
        cidade: pInfo?.cidade ?? "",
        capa: capaMap.get(r.para_id) ?? null,
        bloqueadoEm: r.created_at,
      };
    });
  }

  return (
    <div className="flex flex-col px-5 pt-10 pb-6">
      <Link
        href="/app/perfil"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        ‹ Perfil
      </Link>

      <PageHeading title="Bloqueados" subtitle="Vocês não se veem no feed, stories ou conversas." />

      {itens.length === 0 ? (
        <div className="pt-10 text-center">
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
          <div
            className="display"
            style={{ fontSize: 18, color: "var(--text-1)" }}
          >
            Você não bloqueou ninguém
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              marginTop: 4,
              maxWidth: 300,
              margin: "4px auto 0",
              lineHeight: 1.5,
            }}
          >
            Pra bloquear alguém, abra o perfil dela e toque em ⋯ → Bloquear.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 pt-5">
          {itens.map((b) => (
            <BloqueadoRow key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
