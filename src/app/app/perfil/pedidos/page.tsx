import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PageHeading } from "@/components/page-heading";
import { PedidosTabs, type PedidoItem } from "./pedidos-tabs";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Pedidos de privado — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/pedidos
 *
 * Tela única com 3 tabs (Pendentes, Aprovados, Recusados) onde o user
 * gerencia pedidos de acesso às suas fotos privadas. Mesmo com match
 * a pessoa precisa pedir acesso aqui — a decisão fica do dono.
 * ================================================================== */

type PedidoRaw = {
  id: string;
  solicitante_id: string;
  status: "pendente" | "aprovado" | "negado";
  created_at: string;
};

export default async function PedidosPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const admin = adminClient();

  const { data: pedidosRaw } = await admin
    .from("pedidos_privado")
    .select("id, solicitante_id, status, created_at")
    .eq("alvo_id", meId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (pedidosRaw ?? []) as PedidoRaw[];

  const ids = Array.from(new Set(rows.map((r) => r.solicitante_id)));
  let profMap = new Map<
    string,
    { nome: string; cidade: string | null; tipo: "casal" | "homem" | "mulher" | null }
  >();
  let capaMap = new Map<string, string>();

  if (ids.length > 0) {
    const [profilesRes, fotosRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, nome_exibicao, cidade, estado, tipo")
        .in("id", ids),
      admin
        .from("fotos")
        .select("profile_id, url")
        .in("profile_id", ids)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);

    (profilesRes.data ?? []).forEach((p) => {
      profMap.set(p.id as string, {
        nome: (p.nome_exibicao as string) ?? "Perfil",
        cidade: [p.cidade, p.estado].filter(Boolean).join(", ") || null,
        tipo: (p.tipo as "casal" | "homem" | "mulher" | null) ?? null,
      });
    });

    (fotosRes.data ?? []).forEach((f) => {
      const pid = f.profile_id as string;
      if (!capaMap.has(pid)) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url as string);
        capaMap.set(pid, data.publicUrl);
      }
    });
  }

  function toItem(r: PedidoRaw): PedidoItem {
    const prof = profMap.get(r.solicitante_id);
    return {
      id: r.id,
      solicitanteId: r.solicitante_id,
      nome: prof?.nome ?? "Perfil",
      cidade: prof?.cidade ?? null,
      tipo: prof?.tipo ?? null,
      capa: capaMap.get(r.solicitante_id) ?? null,
      createdAt: r.created_at,
      status: r.status,
    };
  }

  const pendentes = rows.filter((r) => r.status === "pendente").map(toItem);
  const aprovados = rows.filter((r) => r.status === "aprovado").map(toItem);
  const negados = rows.filter((r) => r.status === "negado").map(toItem);

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

      <PageHeading
        title="Pedidos de privado"
        subtitle="Quem pediu acesso às suas fotos privadas"
      />

      <div className="pt-5">
        <PedidosTabs
          pendentes={pendentes}
          aprovados={aprovados}
          negados={negados}
        />
      </div>
    </div>
  );
}
