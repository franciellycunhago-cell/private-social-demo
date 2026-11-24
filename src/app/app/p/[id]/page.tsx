import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getProfileStatus,
  PROFILE_COLS,
  type ProfileRow,
} from "@/lib/supabase/profile";
import Link from "next/link";
import { resolvePhotoSrcs, PHOTO_SIGNED_TTL_SEC, type FotoRow, type FotoComSrc } from "@/lib/supabase/fotos";
import { resolveFotoCapa } from "@/lib/foto-capa";
import { calcularCompatibilidade } from "@/lib/compatibilidade";
import { loadPostsByProfile } from "@/lib/posts/server";
import { checkBloqueio } from "@/lib/moderacao/server";
import { loadActiveCheckinsForProfiles } from "@/lib/checkins/server";
import { makeViewerToken } from "@/lib/watermark-token";
import { registrarPerfilView } from "@/lib/perfil-views/actions";
import { getChatAberto } from "@/lib/app-settings/server";
import { ProfileView } from "./profile-view";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Perfil — PrivateSocial",
};

type Params = Promise<{ id: string }>;

/* ====================================================================
 * /app/p/[id]
 *
 * Perfil detalhado de outro user.
 *  - Carrega profile + fotos (RLS filtra privadas se user não tem acesso)
 *  - Descobre pedidos_privado existente + curtida existente
 *  - Renderiza ProfileView (client) com 3 tabs
 * ================================================================== */

export default async function OutroPerfilPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  if (meId === id) redirect("/app/perfil");

  // Bloqueio: se eu bloqueei OU fui bloqueado, mostra placeholder.
  // Admin bypassa "fui_bloqueado" — precisa enxergar todos os perfis
  // mesmo de quem o bloqueou (moderação + acesso total).
  const bloqueio = await checkBloqueio(meId, id);
  if (bloqueio === "fui_bloqueado" && !info.isAdmin) {
    return <PerfilIndisponivel motivo="indisponivel" />;
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(`${PROFILE_COLS}, suspenso, deletado_em, quem_pode_ver`)
    .eq("id", id)
    .maybeSingle<
      ProfileRow & {
        suspenso: boolean;
        deletado_em: string | null;
        quem_pode_ver: { casal?: boolean; homem?: boolean; mulher?: boolean } | null;
      }
    >();

  if (!profile) notFound();
  // Suspenso ou em carência de exclusão: trata como indisponível pra
  // ninguém abrir o perfil dele direto pelo link.
  if (profile.suspenso || profile.deletado_em) {
    return <PerfilIndisponivel motivo="indisponivel" />;
  }

  // Filtro "quem pode te ver" — se o dono do perfil não permite meu
  // tipo, mostra indisponível. Match existente bypassa (carregamos abaixo
  // também, mas pra isso checamos aqui de forma rápida).
  // Admin bypassa todo o filtro — acesso total a todos os perfis.
  const meuTipo = info.status.profile.tipo;
  if (meuTipo && !info.isAdmin) {
    const qpv = profile.quem_pode_ver ?? {
      casal: true,
      homem: true,
      mulher: true,
    };
    if (qpv[meuTipo] === false) {
      // Verifica se já é match — match bypassa o filtro
      const { data: matchExist } = await supabase
        .from("matches")
        .select("id")
        .or(
          `and(profile_1.eq.${meId},profile_2.eq.${id}),and(profile_1.eq.${id},profile_2.eq.${meId})`,
        )
        .maybeSingle();
      if (!matchExist) {
        return <PerfilIndisponivel motivo="indisponivel" />;
      }
    }
  }
  if (!profile.verificado) {
    // Perfis não verificados só aparecem em match (RLS permite); se chegou aqui
    // por RLS ter liberado mas ainda não é verificado, renderiza placeholder.
  }

  // Tracking de visualização de perfil (VIP feature "quem viu seu perfil")
  // Fire-and-forget — não bloqueia a renderização. Action filtra
  // próprio user e admin (modo invisível) internamente.
  void registrarPerfilView(id);

  const admin = adminClient();

  const [fotosPublicasRes, pedidoRes, curtidaRes, matchRes, totalPrivRes] =
    await Promise.all([
      admin
        .from("fotos")
        .select("id, profile_id, url, tipo, ordem, created_at, likes_count")
        .eq("profile_id", id)
        .eq("tipo", "publica")
        .is("deletado_em", null)
        .order("ordem", { ascending: true }),
      supabase
        .from("pedidos_privado")
        .select("status")
        .eq("solicitante_id", meId)
        .eq("alvo_id", id)
        .maybeSingle(),
      supabase
        .from("curtidas")
        .select("id")
        .eq("de_id", meId)
        .eq("para_id", id)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id")
        .or(
          `and(profile_1.eq.${meId},profile_2.eq.${id}),and(profile_1.eq.${id},profile_2.eq.${meId})`,
        )
        .maybeSingle(),
      // Contagem real de privadas via admin (sem RLS)
      admin
        .from("fotos")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", id)
        .eq("tipo", "privada"),
    ]);

  const publicas = await resolvePhotoSrcs(
    (fotosPublicasRes.data ?? []) as FotoRow[],
  );

  const pedidoStatus =
    (pedidoRes.data?.status as "pendente" | "aprovado" | "negado" | null) ??
    null;
  const jaCurtiu = !!curtidaRes.data;
  const totalPrivadas = totalPrivRes.count ?? 0;

  // Acesso privado exige pedido aprovado mesmo com match (decisão do
  // produto: cada perfil controla quem vê o privado, match é só o
  // gatilho social).
  // Admin bypassa — acesso total inclui ver fotos privadas de qualquer
  // perfil sem precisar de pedido aprovado.
  const acessoPrivado = info.isAdmin || pedidoStatus === "aprovado";
  const effectivePedidoStatus = info.isAdmin ? "aprovado" : pedidoStatus;

  // Fotos privadas: só carrega (via admin) se tem acesso
  let privadasLiberadas: (FotoRow & { likes_count?: number })[] = [];
  if (acessoPrivado && totalPrivadas > 0) {
    const { data: privRows } = await admin
      .from("fotos")
      .select("id, profile_id, url, tipo, ordem, created_at, likes_count")
      .eq("profile_id", id)
      .eq("tipo", "privada")
      .order("ordem", { ascending: true });
    privadasLiberadas = (privRows ?? []) as (FotoRow & {
      likes_count?: number;
    })[];
  }

  // Signed URLs para privadas via admin (bypass storage RLS)
  let privadasComSrc: FotoComSrc[] = [];
  if (privadasLiberadas.length > 0) {
    const { data: signed } = await admin.storage
      .from("fotos-privadas")
      .createSignedUrls(
        privadasLiberadas.map((f) => f.url),
        PHOTO_SIGNED_TTL_SEC,
      );
    const signedMap = new Map<string, string | null>();
    (signed ?? []).forEach((item) => {
      if (item?.path) signedMap.set(item.path, item.signedUrl ?? null);
    });
    privadasComSrc = privadasLiberadas.map((f) => ({
      ...f,
      src: signedMap.get(f.url) ?? null,
    }));
  }

  // Capa vem de profile.foto_capa_path (com fallback pra primeira foto
  // de post se vazio). Substitui o antigo "primeira foto pública".
  const capa = await resolveFotoCapa(admin, id, profile.foto_capa_path);
  const compat = calcularCompatibilidade(info.status.profile, profile);

  // Carrega quais fotos o user logado já curtiu (públicas + privadas
  // liberadas), pra renderizar o ♥ preenchido em vez de outline.
  const allFotoIds = [
    ...publicas.map((f) => f.id),
    ...privadasComSrc.map((f) => f.id),
  ];
  const curtidosSet = new Set<string>();
  if (allFotoIds.length > 0) {
    const { data: curtidasMinhas } = await supabase
      .from("curtidas_foto")
      .select("foto_id")
      .eq("profile_id", meId)
      .in("foto_id", allFotoIds);
    (curtidasMinhas ?? []).forEach((c) => {
      if (c.foto_id) curtidosSet.add(c.foto_id as string);
    });
  }
  // Anota cada foto com o flag curtidoPorMim (likes_count já vem do select)
  const publicasComLikes = publicas.map((f) => ({
    ...f,
    curtidoPorMim: curtidosSet.has(f.id),
  }));
  const privadasComLikes = privadasComSrc.map((f) => ({
    ...f,
    curtidoPorMim: curtidosSet.has(f.id),
  }));

  const posts = await loadPostsByProfile(id, meId);
  const checkinMap = await loadActiveCheckinsForProfiles([id]);
  const checkinAtivo = checkinMap.get(id) ?? null;
  const chatAberto = await getChatAberto();

  return (
    <ProfileView
      perfil={{
        id: profile.id,
        nome: profile.nome_exibicao ?? "Sem nome",
        idades: formatIdades(profile.idade_1, profile.idade_2),
        cidade: [profile.cidade, profile.estado].filter(Boolean).join(", "),
        tipo: profile.tipo,
        experiencia: profile.experiencia,
        trust_score: profile.trust_score,
        verificado: profile.verificado,
        vip: profile.vip_ate ? new Date(profile.vip_ate) > new Date() : false,
        bio: profile.bio,
        intencoes: profile.intencoes ?? [],
        limites: profile.limites ?? [],
        capa,
        checkin: checkinAtivo,
      }}
      publicas={publicasComLikes}
      privadas={privadasComLikes}
      totalPrivadas={totalPrivadas}
      posts={posts}
      pedidoStatus={effectivePedidoStatus}
      jaCurtiu={jaCurtiu}
      jaBloqueado={bloqueio === "eu_bloqueei"}
      compatScore={compat.score}
      isAdmin={info.isAdmin}
      chatAberto={chatAberto}
      meuToken={makeViewerToken(meId)}
    />
  );
}

function PerfilIndisponivel({ motivo }: { motivo: "indisponivel" }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-8"
      style={{ minHeight: "100dvh" }}
    >
      <div style={{ fontSize: 48, marginBottom: 14 }}>🚫</div>
      <div
        className="display"
        style={{ fontSize: 22, fontWeight: 500, color: "var(--text-0)" }}
      >
        Perfil indisponível
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          lineHeight: 1.5,
          marginTop: 8,
          maxWidth: 300,
        }}
      >
        {motivo === "indisponivel" &&
          "Esse perfil não está disponível pra você."}
      </div>
      <Link
        href="/app/descobrir"
        className="btn-gold mt-5"
        style={{ textDecoration: "none" }}
      >
        Voltar ao feed
      </Link>
    </div>
  );
}

function formatIdades(a: number | null, b: number | null): string {
  if (a && b) return `${a} · ${b}`;
  if (a) return `${a}`;
  return "";
}
