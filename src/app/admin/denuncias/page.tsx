import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DenunciaRow, type DenunciaItem } from "./denuncia-row";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ANEXO_TTL = 60 * 30; // 30min — admin tem tempo de revisar

export const metadata = {
  title: "Denúncias — Admin",
};

/* ====================================================================
 * /admin/denuncias
 *
 * Fila de denúncias por status. RLS já filtra (denuncias_select_admin).
 *  - Abertas (mais antigas primeiro)
 *  - Em análise
 *  - Resolvidas (últimas 20)
 * ================================================================== */

type DenunciaRaw = {
  id: string;
  motivo: string;
  descricao: string | null;
  status: "aberta" | "em_analise" | "resolvida";
  created_at: string;
  denunciante_id: string;
  denunciado_id: string;
  anexo_url: string | null;
};

export default async function DenunciasPage() {
  const supabase = await createClient();

  const [abertasRes, analiseRes, resolvidasRes] = await Promise.all([
    supabase
      .from("denuncias")
      .select(
        "id, motivo, descricao, status, created_at, denunciante_id, denunciado_id, anexo_url",
      )
      .eq("status", "aberta")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("denuncias")
      .select(
        "id, motivo, descricao, status, created_at, denunciante_id, denunciado_id, anexo_url",
      )
      .eq("status", "em_analise")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("denuncias")
      .select(
        "id, motivo, descricao, status, created_at, denunciante_id, denunciado_id, anexo_url",
      )
      .eq("status", "resolvida")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const abertas = (abertasRes.data ?? []) as DenunciaRaw[];
  const analise = (analiseRes.data ?? []) as DenunciaRaw[];
  const resolvidas = (resolvidasRes.data ?? []) as DenunciaRaw[];

  const todas = [...abertas, ...analise, ...resolvidas];
  const ids = Array.from(
    new Set(todas.flatMap((d) => [d.denunciante_id, d.denunciado_id])),
  );

  const profilesMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome_exibicao")
      .in("id", ids);
    (profiles ?? []).forEach((p) =>
      profilesMap.set(p.id as string, (p.nome_exibicao as string) ?? "Perfil"),
    );
  }

  // Signed URLs em batch pros anexos (bucket privado)
  const anexoPaths = todas
    .map((d) => d.anexo_url)
    .filter((p): p is string => !!p);
  const signedMap = new Map<string, string>();
  if (anexoPaths.length > 0) {
    const admin = adminClient();
    const { data: signed } = await admin.storage
      .from("denuncias-anexos")
      .createSignedUrls(anexoPaths, ANEXO_TTL);
    (signed ?? []).forEach((item) => {
      if (item?.path && item.signedUrl) {
        signedMap.set(item.path, item.signedUrl);
      }
    });
  }

  function toItem(d: DenunciaRaw): DenunciaItem {
    return {
      id: d.id,
      motivo: d.motivo,
      descricao: d.descricao,
      status: d.status,
      createdAt: d.created_at,
      denunciante: {
        id: d.denunciante_id,
        nome: profilesMap.get(d.denunciante_id) ?? "Perfil",
      },
      alvo: {
        id: d.denunciado_id,
        nome: profilesMap.get(d.denunciado_id) ?? "Perfil",
      },
      anexoSignedUrl: d.anexo_url
        ? (signedMap.get(d.anexo_url) ?? null)
        : null,
    };
  }

  const abertasI = abertas.map(toItem);
  const analiseI = analise.map(toItem);
  const resolvidasI = resolvidas.map(toItem);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            Denúncias
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            Revise denúncias abertas e marque conforme o desfecho.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5" style={{ minWidth: 320 }}>
          <Stat label="Abertas" value={abertasI.length} accent />
          <Stat label="Em análise" value={analiseI.length} />
          <Stat label="Resolvidas" value={resolvidasI.length} />
        </div>
      </header>

      <Section title="Abertas" empty="Nenhuma denúncia aberta.">
        {abertasI.map((d) => (
          <DenunciaRow key={d.id} d={d} />
        ))}
      </Section>

      <Section title="Em análise" empty="Nenhuma em análise.">
        {analiseI.map((d) => (
          <DenunciaRow key={d.id} d={d} />
        ))}
      </Section>

      <Section title="Recém-resolvidas" empty="Nenhuma resolvida ainda.">
        {resolvidasI.map((d) => (
          <DenunciaRow key={d.id} d={d} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.length === 0 || (arr.length === 1 && !arr[0]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="display" style={{ fontSize: 18, fontWeight: 600 }}>
        {title}
      </h2>
      {isEmpty ? (
        <div
          className="card flex items-center justify-center py-8"
          style={{ fontSize: 13, color: "var(--text-3)" }}
        >
          {empty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="card p-3"
      style={
        accent
          ? {
              background:
                "linear-gradient(135deg, rgba(212,175,110,0.18), rgba(212,175,110,0.04))",
              borderColor: "var(--gold-500)",
            }
          : undefined
      }
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </div>
      <div
        className="display mt-1"
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: accent ? "var(--gold-300)" : "var(--text-0)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
