"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { createNotificacao } from "@/lib/notificacoes";
import { loadBlockedSet } from "@/lib/moderacao/server";
import { loadActiveCheckinsForProfiles } from "@/lib/checkins/server";
import type { FeedPost } from "./feed";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions /app/descobrir
 *
 *  - likeProfile(targetId, tipo): insere em `curtidas`. O trigger
 *    `curtidas_create_match` cria o match automaticamente se houver
 *    like mútuo. Retorna { matched: boolean }.
 *
 *  - passProfile(targetId): registra "passada" em eventos_app
 *
 *  - togglePostLike(postId, curtir): like/unlike no post (social, não
 *    gera match). Trigger atualiza posts.likes_count.
 * ================================================================== */

export type LikeResult =
  | { matched: true; matchId: string }
  | { matched: false }
  | { error: string };

export async function likeProfile(
  targetId: string,
  tipo: "like" | "super" = "like",
): Promise<LikeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === targetId) return { error: "Você não pode curtir a si mesmo." };

  const { error } = await supabase
    .from("curtidas")
    .insert({ de_id: user.id, para_id: targetId, tipo });

  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  const a = user.id < targetId ? user.id : targetId;
  const b = user.id < targetId ? targetId : user.id;
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("profile_1", a)
    .eq("profile_2", b)
    .maybeSingle();

  if (match?.id) {
    // Fire-and-forget: notifica o outro que deu match (push + tela)
    void sendPushToUser(
      targetId,
      {
        title: "Novo match! 🎉",
        body: "Alguém curtiu você de volta. Vai lá falar!",
        url: `/app/conversas/${match.id}`,
      },
      "matches",
    );
    void createNotificacao({
      userId: targetId,
      actorId: user.id,
      tipo: "match",
      matchId: match.id,
    });
    return { matched: true, matchId: match.id };
  }

  // Sem match ainda — só notifica que o user curtiu o perfil dele.
  // Push só dispara se o user permitir em notif_prefs.curtida_recebida.
  void createNotificacao({
    userId: targetId,
    actorId: user.id,
    tipo: "curtiu_perfil",
  });
  void sendPushToUser(
    targetId,
    {
      title: "Alguém curtiu seu perfil 💛",
      body: "Toca aqui pra ver quem curtiu você.",
      url: `/app/p/${user.id}`,
    },
    "curtida_recebida",
  );

  return { matched: false };
}

export async function passProfile(targetId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("eventos_app").insert({
    profile_id: user.id,
    tipo: "discover_pass",
    metadata: { target: targetId },
  });
}

/* ====================================================================
 * loadMorePosts — paginação por cursor pra scroll infinito do feed.
 *
 * Usa created_at do último post visível como cursor. Filtra com a mesma
 * lógica da página (blocked, suspenso, deletado, tipo, quem_pode_ver).
 * Sem boost VIP no rank — só ordena por created_at desc dentro do batch
 * (boost VIP só importa na primeira página, no topo do feed).
 * ================================================================== */

const PAGE_SIZE = 15;

export type LoadMoreResult =
  | { posts: FeedPost[]; hasMore: boolean }
  | { error: string };

export async function loadMorePosts(
  cursor: string,
  tipoFiltro?: string,
): Promise<LoadMoreResult> {
  if (!cursor) return { error: "Cursor inválido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  const meId = user.id;

  const admin = adminClient();

  // Carrega contexto do user em paralelo
  const [{ data: meProfile }, { data: adminRow }, blockedSet] = await Promise.all([
    admin
      .from("profiles")
      .select("tipo")
      .eq("id", meId)
      .maybeSingle<{ tipo: "casal" | "homem" | "mulher" | null }>(),
    admin.from("admins").select("profile_id").eq("profile_id", meId).maybeSingle(),
    loadBlockedSet(meId),
  ]);
  const meuTipo = meProfile?.tipo ?? null;
  const isAdmin = !!adminRow;

  // Busca PAGE_SIZE * 3 pra ter material após filtragem (mesma estratégia
  // da página). Cursor: created_at < cursor (estritamente menor pra não
  // duplicar o último post).
  const { data: postsRaw, error: postsErr } = await admin
    .from("posts")
    .select(
      "id, profile_id, texto, likes_count, comentarios_count, created_at, pinned_em",
    )
    .lt("created_at", cursor)
    .is("pinned_em", null) // pinned só aparece na primeira página
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE * 3);
  if (postsErr) return { error: postsErr.message };

  type PostRow = {
    id: string;
    profile_id: string;
    texto: string;
    likes_count: number;
    comentarios_count: number;
    created_at: string;
    pinned_em: string | null;
  };

  const candidatos = ((postsRaw ?? []) as PostRow[]).filter(
    (p) => isAdmin || !blockedSet.has(p.profile_id),
  );

  if (candidatos.length === 0) {
    return { posts: [], hasMore: false };
  }

  const profileIds = Array.from(new Set(candidatos.map((p) => p.profile_id)));
  const postIds = candidatos.map((p) => p.id);

  const [
    profilesRes,
    fotosPostRes,
    meusLikesRes,
    minhasCurtidasRes,
    checkinsMap,
    matchesRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, handle, nome_exibicao, tipo, cidade, estado, verificado, vip_ate, suspenso, deletado_em, quem_pode_ver, foto_capa_path",
      )
      .in("id", profileIds),
    admin
      .from("posts_fotos")
      .select("id, post_id, url, ordem")
      .in("post_id", postIds)
      .order("ordem", { ascending: true }),
    admin
      .from("posts_likes")
      .select("post_id")
      .eq("profile_id", meId)
      .in("post_id", postIds),
    admin
      .from("curtidas")
      .select("para_id")
      .eq("de_id", meId)
      .in("para_id", profileIds),
    loadActiveCheckinsForProfiles(profileIds),
    admin
      .from("matches")
      .select("profile_1, profile_2")
      .or(`profile_1.eq.${meId},profile_2.eq.${meId}`),
  ]);

  type ProfileLite = {
    id: string;
    handle: string | null;
    nome_exibicao: string | null;
    tipo: "casal" | "homem" | "mulher" | null;
    cidade: string | null;
    estado: string | null;
    verificado: boolean;
    vip_ate: string | null;
    suspenso: boolean;
    deletado_em: string | null;
    quem_pode_ver: { casal?: boolean; homem?: boolean; mulher?: boolean } | null;
    foto_capa_path: string | null;
  };

  const profilesMap = new Map<string, ProfileLite>();
  ((profilesRes.data ?? []) as ProfileLite[]).forEach((p) => profilesMap.set(p.id, p));

  // Capa por perfil = foto_capa_path resolvido
  const capaMap = new Map<string, string>();
  profilesMap.forEach((prof, pid) => {
    if (prof.foto_capa_path) {
      const { data } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(prof.foto_capa_path);
      if (data.publicUrl) capaMap.set(pid, data.publicUrl);
    }
  });

  const fotosByPost = new Map<string, { id: string; src: string }[]>();
  (fotosPostRes.data ?? []).forEach((f) => {
    const pid = f.post_id as string;
    const { data } = admin.storage
      .from("fotos-publicas")
      .getPublicUrl(f.url as string);
    const arr = fotosByPost.get(pid) ?? [];
    arr.push({ id: f.id as string, src: data.publicUrl });
    fotosByPost.set(pid, arr);
  });

  const likedSet = new Set<string>(
    (meusLikesRes.data ?? []).map((l) => l.post_id as string),
  );
  const curtidoPerfilSet = new Set<string>(
    (minhasCurtidasRes.data ?? []).map((c) => c.para_id as string),
  );
  const matchedSet = new Set<string>(
    ((matchesRes.data ?? []) as Array<{ profile_1: string; profile_2: string }>).map(
      (m) => (m.profile_1 === meId ? m.profile_2 : m.profile_1),
    ),
  );

  const filterByTipo =
    tipoFiltro === "casal" || tipoFiltro === "mulher" || tipoFiltro === "homem";

  const posts: FeedPost[] = candidatos
    .map((p): FeedPost | null => {
      const prof = profilesMap.get(p.profile_id);
      if (!prof || !prof.verificado) return null;
      if (prof.suspenso || prof.deletado_em) return null;
      if (filterByTipo && prof.tipo !== tipoFiltro) return null;
      if (meuTipo && !isAdmin && !matchedSet.has(prof.id)) {
        const qpv = prof.quem_pode_ver ?? { casal: true, homem: true, mulher: true };
        if (qpv[meuTipo] === false) return null;
      }
      return {
        id: p.id,
        texto: p.texto,
        createdAt: p.created_at,
        likes: p.likes_count,
        comentarios: p.comentarios_count,
        curtiPorMim: likedSet.has(p.id),
        jaCurtiPerfil: curtidoPerfilSet.has(p.profile_id),
        isMyPost: p.profile_id === meId,
        pinnedEm: p.pinned_em,
        fotos: fotosByPost.get(p.id) ?? [],
        autor: {
          id: prof.id,
          nome: prof.nome_exibicao ?? "Sem nome",
          handle: prof.handle,
          cidade: [prof.cidade, prof.estado].filter(Boolean).join(", "),
          tipo: prof.tipo,
          verificado: prof.verificado,
          vip: prof.vip_ate ? new Date(prof.vip_ate) > new Date() : false,
          capa: capaMap.get(prof.id) ?? null,
          checkin: checkinsMap.get(prof.id) ?? null,
        },
      };
    })
    .filter((p): p is FeedPost => p !== null)
    .slice(0, PAGE_SIZE);

  // hasMore: se voltou MENOS que PAGE_SIZE * 3 candidatos, é fim de fila.
  // Se voltou >= PAGE_SIZE * 3 e o filtro deixou >= PAGE_SIZE, ainda tem mais.
  const hasMore =
    (postsRaw?.length ?? 0) >= PAGE_SIZE * 3 && posts.length >= PAGE_SIZE;

  return { posts, hasMore };
}

/* ====================================================================
 * loadFeedProfileSuggestions — quando os posts do feed acabam, mostra
 * perfis ativos pra descobrir. O feed nunca termina enquanto houver
 * gente verificada no app.
 *
 * Exclui:
 *  - Eu mesmo
 *  - Perfis já mostrados no feed (excludeProfileIds)
 *  - Bloqueados
 *  - Suspensos / deletados
 *  - quem_pode_ver bate com meu tipo (admin bypassa)
 *
 * Ordena por ultimo_ativo desc. Cursor = ultimo_ativo (ISO string).
 * ================================================================== */

export type FeedProfileSuggestion = {
  id: string;
  nome: string;
  handle: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string;
  idade1: number | null;
  idade2: number | null;
  vip: boolean;
  capa: string | null;
  jaCurti: boolean;
  ultimoAtivo: string | null;
};

export type LoadProfileSuggestionsResult =
  | { profiles: FeedProfileSuggestion[]; hasMore: boolean }
  | { error: string };

const SUGGESTIONS_PAGE = 12;

export async function loadFeedProfileSuggestions(
  excludeProfileIds: string[],
  cursor?: string,
): Promise<LoadProfileSuggestionsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  const meId = user.id;

  const admin = adminClient();

  const [{ data: meProfile }, { data: adminRow }, blockedSet] = await Promise.all([
    admin
      .from("profiles")
      .select("tipo")
      .eq("id", meId)
      .maybeSingle<{ tipo: "casal" | "homem" | "mulher" | null }>(),
    admin.from("admins").select("profile_id").eq("profile_id", meId).maybeSingle(),
    loadBlockedSet(meId),
  ]);
  const meuTipo = meProfile?.tipo ?? null;
  const isAdmin = !!adminRow;

  // Busca PAGE * 3 pra ter folga após filtrar. ultimo_ativo nulls last.
  let query = admin
    .from("profiles")
    .select(
      "id, handle, nome_exibicao, tipo, cidade, estado, idade_1, idade_2, vip_ate, suspenso, deletado_em, quem_pode_ver, ultimo_ativo, foto_capa_path",
    )
    .eq("verificado", true)
    .eq("suspenso", false)
    .is("deletado_em", null)
    .neq("id", meId)
    .order("ultimo_ativo", { ascending: false, nullsFirst: false })
    .limit(SUGGESTIONS_PAGE * 3);

  if (cursor) {
    query = query.lt("ultimo_ativo", cursor);
  }

  const { data: profilesRaw, error: profErr } = await query;
  if (profErr) return { error: profErr.message };

  type ProfileRow = {
    id: string;
    handle: string | null;
    nome_exibicao: string | null;
    tipo: "casal" | "homem" | "mulher" | null;
    cidade: string | null;
    estado: string | null;
    idade_1: number | null;
    idade_2: number | null;
    vip_ate: string | null;
    suspenso: boolean;
    deletado_em: string | null;
    quem_pode_ver: { casal?: boolean; homem?: boolean; mulher?: boolean } | null;
    ultimo_ativo: string | null;
    foto_capa_path: string | null;
  };

  const excludeSet = new Set(excludeProfileIds);
  const todos = (profilesRaw ?? []) as ProfileRow[];

  // Matches do user — bypassa quem_pode_ver pra quem já é match
  const { data: matchesData } = await admin
    .from("matches")
    .select("profile_1, profile_2")
    .or(`profile_1.eq.${meId},profile_2.eq.${meId}`);
  const matchedSet = new Set<string>(
    ((matchesData ?? []) as Array<{ profile_1: string; profile_2: string }>).map(
      (m) => (m.profile_1 === meId ? m.profile_2 : m.profile_1),
    ),
  );

  const filtrados = todos.filter((p) => {
    if (excludeSet.has(p.id)) return false;
    if (!isAdmin && blockedSet.has(p.id)) return false;
    if (meuTipo && !isAdmin && !matchedSet.has(p.id)) {
      const qpv = p.quem_pode_ver ?? { casal: true, homem: true, mulher: true };
      if (qpv[meuTipo] === false) return false;
    }
    return true;
  });

  if (filtrados.length === 0) {
    return { profiles: [], hasMore: false };
  }

  const ids = filtrados.map((p) => p.id);

  // Capa de cada perfil = profile.foto_capa_path resolvido
  const capaMap = new Map<string, string>();
  filtrados.forEach((p) => {
    if (p.foto_capa_path) {
      const { data: pu } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(p.foto_capa_path);
      if (pu.publicUrl) capaMap.set(p.id, pu.publicUrl);
    }
  });

  // Minhas curtidas em perfil (pra mostrar "já curtido")
  const { data: minhasCurt } = await admin
    .from("curtidas")
    .select("para_id")
    .eq("de_id", meId)
    .in("para_id", ids);
  const jaCurtiSet = new Set<string>(
    (minhasCurt ?? []).map((c) => c.para_id as string),
  );

  const profiles: FeedProfileSuggestion[] = filtrados
    .slice(0, SUGGESTIONS_PAGE)
    .map((p) => ({
      id: p.id,
      nome: p.nome_exibicao ?? "Sem nome",
      handle: p.handle,
      tipo: p.tipo,
      cidade: [p.cidade, p.estado].filter(Boolean).join(", "),
      idade1: p.idade_1,
      idade2: p.idade_2,
      vip: p.vip_ate ? new Date(p.vip_ate) > new Date() : false,
      capa: capaMap.get(p.id) ?? null,
      jaCurti: jaCurtiSet.has(p.id),
      ultimoAtivo: p.ultimo_ativo,
    }));

  const hasMore =
    (profilesRaw?.length ?? 0) >= SUGGESTIONS_PAGE * 3 && profiles.length >= SUGGESTIONS_PAGE;

  return { profiles, hasMore };
}

export async function togglePostLike(
  postId: string,
  curtir: boolean,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  if (curtir) {
    const { error } = await admin
      .from("posts_likes")
      .insert({ post_id: postId, profile_id: user.id });
    if (error && error.code !== "23505") return { error: error.message };

    // Notifica dono do post (se não for o próprio user). Carrega só o
    // profile_id do post — barato. Push respeita notif_prefs.curtidas_post.
    const { data: post } = await admin
      .from("posts")
      .select("profile_id")
      .eq("id", postId)
      .maybeSingle<{ profile_id: string }>();

    if (post?.profile_id && post.profile_id !== user.id) {
      const { data: actor } = await admin
        .from("profiles")
        .select("nome_exibicao")
        .eq("id", user.id)
        .maybeSingle<{ nome_exibicao: string }>();
      const nomeAtor = actor?.nome_exibicao ?? "Alguém";

      void createNotificacao({
        userId: post.profile_id,
        actorId: user.id,
        tipo: "curtiu_post",
        postId,
      });
      void sendPushToUser(
        post.profile_id,
        {
          title: `${nomeAtor} curtiu seu post`,
          body: "Toca pra ver quem curtiu.",
          url: `/app/p/${user.id}`,
        },
        "curtidas_post",
      );
    }
  } else {
    const { error } = await admin
      .from("posts_likes")
      .delete()
      .eq("post_id", postId)
      .eq("profile_id", user.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

