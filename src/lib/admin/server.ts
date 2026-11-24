import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VERIF_SIGNED_TTL = 60 * 30;
const FOTO_PRIV_SIGNED_TTL = 60 * 30;

export type AdminUserDetail = {
  id: string;
  nome: string | null;
  handle: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  idade1: number | null;
  idade2: number | null;
  bio: string | null;
  experiencia: string | null;
  trustScore: number;
  verificado: boolean;
  vipAte: string | null;
  ultimoAtivo: string | null;
  criadoEm: string | null;
  suspenso: boolean;
  suspensoEm: string | null;
  suspensoMotivo: string | null;
  deletadoEm: string | null;
  capa: string | null;
  fotosPublicas: { id: string; src: string; deletada: boolean }[];
  fotosPrivadas: { id: string; src: string; deletada: boolean }[];
  selfieVerificacao: string | null;
  selfieStatus: "pendente" | "aprovado" | "rejeitado" | null;
  selfieRevisadoPorId: string | null;
  selfieRevisadoPorNome: string | null;
  selfieRevisadoEm: string | null;
  selfieMotivo: string | null;
  telefone: string | null;
  postsCount: number;
  matchesCount: number;
  curtidasEnviadasCount: number;
  denunciasRecebidasCount: number;
};

export async function loadAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const admin = adminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, nome_exibicao, handle, cidade, estado, tipo, idade_1, idade_2, bio, experiencia, trust_score, verificado, vip_ate, ultimo_ativo, created_at, suspenso, suspenso_em, suspenso_motivo, deletado_em, telefone",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const [
    fotosRes,
    verifRes,
    postsCountRes,
    matchesCountRes,
    curtidasCountRes,
    denunciasCountRes,
    authRes,
  ] = await Promise.all([
    admin
      .from("fotos")
      .select("id, url, tipo, ordem, deletado_em")
      .eq("profile_id", userId)
      .order("ordem", { ascending: true }),
    admin
      .from("verificacoes")
      .select("foto_url, status, created_at, revisado_por, revisado_em, motivo_rejeicao")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", userId)
      .then((r) => r.count ?? 0),
    admin
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`profile_1.eq.${userId},profile_2.eq.${userId}`)
      .then((r) => r.count ?? 0),
    admin
      .from("curtidas")
      .select("*", { count: "exact", head: true })
      .eq("de_id", userId)
      .then((r) => r.count ?? 0),
    admin
      .from("denuncias")
      .select("*", { count: "exact", head: true })
      .eq("denunciado_id", userId)
      .then((r) => r.count ?? 0),
    admin.auth.admin.getUserById(userId),
  ]);

  const fotos = (fotosRes.data ?? []) as Array<{
    id: string;
    url: string;
    tipo: "publica" | "privada";
    ordem: number;
    deletado_em: string | null;
  }>;
  const fotosPub = fotos.filter((f) => f.tipo === "publica");
  const fotosPriv = fotos.filter((f) => f.tipo === "privada");

  // Públicas: getPublicUrl direto (fotos deletadas: src vazio, badge no admin)
  const fotosPublicas = fotosPub.map((f) => {
    const deletada = !!f.deletado_em;
    if (deletada) return { id: f.id, src: "", deletada: true };
    const { data } = admin.storage.from("fotos-publicas").getPublicUrl(f.url);
    return { id: f.id, src: data.publicUrl, deletada: false };
  });

  // Privadas: signed URL (fotos deletadas: src vazio)
  let fotosPrivadas: { id: string; src: string; deletada: boolean }[] = [];
  if (fotosPriv.length > 0) {
    const ativas = fotosPriv.filter((f) => !f.deletado_em);
    const deletadas = fotosPriv.filter((f) => !!f.deletado_em);

    let signedMap = new Map<string, string>();
    if (ativas.length > 0) {
      const { data: signed } = await admin.storage
        .from("fotos-privadas")
        .createSignedUrls(
          ativas.map((f) => f.url),
          FOTO_PRIV_SIGNED_TTL,
        );
      (signed ?? []).forEach((s) => {
        if (s?.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
      });
    }

    fotosPrivadas = [
      ...ativas.map((f) => ({ id: f.id, src: signedMap.get(f.url) ?? "", deletada: false })),
      ...deletadas.map((f) => ({ id: f.id, src: "", deletada: true })),
    ];
  }

  // Selfie de verificação: signed URL + quem revisou
  let selfieVerificacao: string | null = null;
  let selfieStatus: "pendente" | "aprovado" | "rejeitado" | null = null;
  let selfieRevisadoPorId: string | null = null;
  let selfieRevisadoPorNome: string | null = null;
  let selfieRevisadoEm: string | null = null;
  let selfieMotivo: string | null = null;

  if (verifRes.data?.foto_url) {
    selfieStatus = verifRes.data.status as "pendente" | "aprovado" | "rejeitado" | null;
    selfieRevisadoPorId = (verifRes.data.revisado_por as string | null) ?? null;
    selfieRevisadoEm = (verifRes.data.revisado_em as string | null) ?? null;
    selfieMotivo = (verifRes.data.motivo_rejeicao as string | null) ?? null;

    // Busca nome do admin que aprovou/rejeitou
    if (selfieRevisadoPorId) {
      const { data: adminProfile } = await admin
        .from("profiles")
        .select("nome_exibicao")
        .eq("id", selfieRevisadoPorId)
        .maybeSingle();
      selfieRevisadoPorNome = (adminProfile?.nome_exibicao as string | null) ?? "Admin";
    }

    const { data } = await admin.storage
      .from("verificacoes")
      .createSignedUrl(verifRes.data.foto_url as string, VERIF_SIGNED_TTL);
    selfieVerificacao = data?.signedUrl ?? null;
  }

  return {
    id: profile.id as string,
    nome: profile.nome_exibicao as string | null,
    handle: profile.handle as string | null,
    email: authRes.data?.user?.email ?? null,
    cidade: profile.cidade as string | null,
    estado: profile.estado as string | null,
    tipo: profile.tipo as "casal" | "homem" | "mulher" | null,
    idade1: profile.idade_1 as number | null,
    idade2: profile.idade_2 as number | null,
    bio: profile.bio as string | null,
    experiencia: profile.experiencia as string | null,
    trustScore: (profile.trust_score as number) ?? 0,
    verificado: profile.verificado as boolean,
    vipAte: profile.vip_ate as string | null,
    ultimoAtivo: profile.ultimo_ativo as string | null,
    criadoEm: (profile.created_at as string | undefined) ?? null,
    suspenso: (profile.suspenso as boolean) ?? false,
    suspensoEm: profile.suspenso_em as string | null,
    suspensoMotivo: profile.suspenso_motivo as string | null,
    deletadoEm: profile.deletado_em as string | null,
    capa: fotosPublicas[0]?.src ?? null,
    fotosPublicas,
    fotosPrivadas,
    selfieVerificacao,
    selfieStatus,
    selfieRevisadoPorId,
    selfieRevisadoPorNome,
    selfieRevisadoEm,
    selfieMotivo,
    telefone: (profile.telefone as string | null) ?? null,
    postsCount: postsCountRes,
    matchesCount: matchesCountRes,
    curtidasEnviadasCount: curtidasCountRes,
    denunciasRecebidasCount: denunciasCountRes,
  };
}
