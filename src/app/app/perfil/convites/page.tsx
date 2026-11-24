import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PageHeading } from "@/components/page-heading";
import { ConvitesPanel, type ConviteItem } from "./convites-panel";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Convites — PrivateSocial",
};

const MAX_CONVITES_ATIVOS = 5;

/* ====================================================================
 * /app/perfil/convites
 *
 * Mostra:
 *  - Slots disponíveis (5 - convites ativos)
 *  - Botão pra gerar novo
 *  - Lista de convites: ativos (com botão copiar/cancelar) e
 *    histórico (usados, com link pro perfil convidado)
 *
 * Só verificados podem gerar — não-verificados veem CTA pra
 * verificar primeiro.
 * ================================================================== */

export default async function ConvitesPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;
  const verificado = info.status.profile.verificado;

  const admin = adminClient();
  const agora = new Date().toISOString();

  const { data: rows } = await admin
    .from("convites")
    .select("id, codigo, convidante_id, convidado_id, usado_em, expira_em, created_at")
    .eq("convidante_id", meId)
    .order("created_at", { ascending: false })
    .limit(50);

  type ConviteRaw = {
    id: string;
    codigo: string;
    convidado_id: string | null;
    usado_em: string | null;
    expira_em: string;
    created_at: string;
  };

  const all = (rows ?? []) as ConviteRaw[];

  // Resolve nome do convidado se já entrou
  const convidadosIds = all
    .map((c) => c.convidado_id)
    .filter((x): x is string => !!x);
  const nomeMap = new Map<string, { nome: string; verificado: boolean }>();
  if (convidadosIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, nome_exibicao, verificado")
      .in("id", convidadosIds);
    (profs ?? []).forEach((p) =>
      nomeMap.set(p.id as string, {
        nome: (p.nome_exibicao as string) ?? "Perfil",
        verificado: !!p.verificado,
      }),
    );
  }

  const items: ConviteItem[] = all.map((c) => {
    const expirou = new Date(c.expira_em).getTime() < Date.now();
    const usado = !!c.usado_em;
    const convidado = c.convidado_id
      ? {
          id: c.convidado_id,
          nome: nomeMap.get(c.convidado_id)?.nome ?? "Perfil",
          verificado: nomeMap.get(c.convidado_id)?.verificado ?? false,
        }
      : null;
    let status: ConviteItem["status"] = "ativo";
    if (usado) status = convidado?.verificado ? "verificado" : "aceito";
    else if (expirou) status = "expirado";
    return {
      id: c.id,
      codigo: c.codigo,
      status,
      criadoEm: c.created_at,
      expiraEm: c.expira_em,
      usadoEm: c.usado_em,
      convidado,
    };
  });

  const ativos = items.filter((c) => c.status === "ativo");
  const historico = items.filter((c) => c.status !== "ativo");
  const slotsLivres = Math.max(0, MAX_CONVITES_ATIVOS - ativos.length);

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
        title="Convites"
        subtitle={`${slotsLivres} de ${MAX_CONVITES_ATIVOS} disponíveis · validade 30 dias`}
      />

      {!verificado ? (
        <div
          className="card flex flex-col items-center text-center gap-2 mt-6"
          style={{ padding: 32 }}
        >
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div
            className="display"
            style={{ fontSize: 16, fontWeight: 500, color: "var(--text-1)" }}
          >
            Verificação obrigatória
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            Só perfis verificados podem convidar. Termine sua verificação
            primeiro pra liberar os convites.
          </div>
        </div>
      ) : (
        <div className="pt-5">
          <ConvitesPanel
            ativos={ativos}
            historico={historico}
            slotsLivres={slotsLivres}
            limiteTotal={MAX_CONVITES_ATIVOS}
          />
        </div>
      )}
    </div>
  );
}
