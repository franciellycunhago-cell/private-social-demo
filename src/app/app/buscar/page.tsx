import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus, PROFILE_COLS } from "@/lib/supabase/profile";
import type { ProfileRow } from "@/lib/supabase/profile";
import { PageHeading } from "@/components/page-heading";
import { SearchForm } from "./search-form";

export const metadata = {
  title: "Buscar — PrivateSocial",
};

/* ====================================================================
 * /app/buscar?q=termo
 *
 * Sem busca → galeria 3-col de TODOS os perfis ativos (verificados,
 * não suspensos, não deletados), ordenados por ultimo_ativo desc.
 * Com busca → mesma galeria mas filtrada por nome/handle/cidade/token.
 *
 *  - Cap em 90 resultados pra evitar payload pesado
 *  - Cover = primeira foto pública não deletada
 *  - Aceita "@fulano" (strip do @) e "TC-XXXXXX"
 * ================================================================== */

const LIMITE = 90;

type SearchParams = Promise<{ q?: string }>;

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const { q } = await searchParams;
  const termoRaw = (q ?? "").trim();
  const termo = termoRaw.replace(/^@+/, "");

  const supabase = await createClient();

  // Detecta busca por token: TC-XXXXXX ou só os 6 chars hex
  const tokenMatch = termoRaw
    .toUpperCase()
    .replace(/^TC-?/i, "")
    .match(/^[0-9A-F]{4,6}$/);

  let resultados: ProfileRow[] = [];

  if (termo.length >= 2 && tokenMatch) {
    // Busca por token — pega prefix do UUID em hex sem dashes
    const prefix = tokenMatch[0];
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("verificado", true)
      .eq("suspenso", false)
      .is("deletado_em", null)
      .neq("id", meId)
      .limit(2000);
    resultados = ((allProfiles ?? []) as ProfileRow[])
      .filter((p) => p.id.replace(/-/g, "").toUpperCase().startsWith(prefix))
      .slice(0, LIMITE);
  } else if (termo.length >= 2) {
    const pattern = `%${termo}%`;
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("verificado", true)
      .eq("suspenso", false)
      .is("deletado_em", null)
      .neq("id", meId)
      .or(
        `nome_exibicao.ilike.${pattern},handle.ilike.${pattern},cidade.ilike.${pattern}`,
      )
      .order("ultimo_ativo", { ascending: false, nullsFirst: false })
      .limit(LIMITE);
    resultados = (data ?? []) as ProfileRow[];
  } else {
    // SEM busca → galeria de perfis ativos (mais recentes primeiro)
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("verificado", true)
      .eq("suspenso", false)
      .is("deletado_em", null)
      .neq("id", meId)
      .order("ultimo_ativo", { ascending: false, nullsFirst: false })
      .limit(LIMITE);
    resultados = (data ?? []) as ProfileRow[];
  }

  // Capa de cada perfil = profile.foto_capa_path resolvido
  const fotoMap = new Map<string, string>();
  resultados.forEach((r) => {
    if (r.foto_capa_path) {
      const { data: pu } = supabase.storage
        .from("fotos-publicas")
        .getPublicUrl(r.foto_capa_path);
      if (pu.publicUrl) fotoMap.set(r.id, pu.publicUrl);
    }
  });

  const isBuscando = termo.length >= 2;

  return (
    <div className="flex flex-col px-5 pt-10 pb-6">
      <PageHeading
        title="Descobrir"
        subtitle={
          isBuscando
            ? `Resultados para "${termo}"`
            : "Perfis ativos no PrivateSocial"
        }
      />

      <div className="pt-4">
        <SearchForm inicial={q ?? ""} />
      </div>

      {termo.length === 1 && (
        <EmptyState
          titulo="Digite mais um caractere"
          sub="Mínimo 2 caracteres pra buscar."
        />
      )}

      {isBuscando && resultados.length === 0 && (
        <EmptyState
          titulo="Nada encontrado"
          sub={`Ninguém com "${termo}" ainda.`}
        />
      )}

      {!isBuscando && resultados.length === 0 && (
        <EmptyState
          titulo="Nenhum perfil ativo ainda"
          sub="Volte mais tarde — a comunidade está crescendo."
        />
      )}

      {resultados.length > 0 && (
        <div
          className="pt-5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
          {resultados.map((r) => (
            <ProfileTile
              key={r.id}
              perfil={r}
              capa={fotoMap.get(r.id) ?? null}
            />
          ))}
        </div>
      )}

      {!isBuscando && resultados.length >= LIMITE && (
        <div
          className="pt-6 text-center mono"
          style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: 1.5 }}
        >
          MOSTRANDO OS {LIMITE} MAIS ATIVOS
        </div>
      )}
    </div>
  );
}

function ProfileTile({
  perfil,
  capa,
}: {
  perfil: ProfileRow;
  capa: string | null;
}) {
  const nome = perfil.nome_exibicao ?? "Perfil";
  const isVip = perfil.vip_ate
    ? new Date(perfil.vip_ate) > new Date()
    : false;

  return (
    <Link
      href={`/app/p/${perfil.id}`}
      className="relative overflow-hidden block"
      style={{
        aspectRatio: "3/4",
        borderRadius: 10,
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      {capa ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={capa}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: "var(--gold-300)", fontSize: 28 }}
        >
          ♥
        </div>
      )}

      {/* VIP badge canto sup direito */}
      {isVip && (
        <span
          className="absolute"
          style={{
            top: 5,
            right: 5,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontSize: 8,
            fontWeight: 800,
            padding: "1px 5px",
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          VIP
        </span>
      )}

      {/* Gradiente + nome no rodapé */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          padding: "16px 8px 6px",
          pointerEvents: "none",
        }}
      >
        <div
          className="truncate"
          style={{
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {nome}
        </div>
        {perfil.cidade && (
          <div
            className="truncate"
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 9,
              marginTop: 1,
            }}
          >
            {perfil.cidade}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="pt-10 flex flex-col items-center text-center gap-2">
      <div
        className="display"
        style={{ fontSize: 20, color: "var(--text-1)", fontWeight: 500 }}
      >
        {titulo}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
