import { createClient } from "./supabase/server";
import { resolveStoriesMedia } from "./stories";
import { loadActiveCheckinsForProfiles } from "./checkins/server";
import type { StoryRow, StoriesBarAutor } from "./stories-types";

/* ====================================================================
 * loadStoriesBarForUser — helper server que carrega stories dos matches
 * de um user (para renderizar o carrossel no topo de /app/conversas e
 * /app/descobrir).
 *
 * Lógica:
 *  1. Busca matches do user (profile_1 ou profile_2)
 *  2. Busca stories ativos (expires_at > now) desses profiles
 *  3. Junta nome + capa do autor + estado de liked/viewed
 *  4. Agrupa por autor, ordena com "não vistos" primeiro
 * ================================================================== */

type MatchLite = {
  id: string;
  profile_1: string;
  profile_2: string;
};

export async function loadStoriesBarForUser(
  me: string,
): Promise<StoriesBarAutor[]> {
  const supabase = await createClient();

  const { data: matchesRaw } = await supabase
    .from("matches")
    .select("id, profile_1, profile_2")
    .or(`profile_1.eq.${me},profile_2.eq.${me}`);

  const matches = (matchesRaw ?? []) as MatchLite[];
  if (matches.length === 0) return [];

  const otherIds = matches.map((m) =>
    m.profile_1 === me ? m.profile_2 : m.profile_1,
  );

  const { data: storiesRaw } = await supabase
    .from("stories")
    .select(
      "id, profile_id, media_url, media_tipo, duracao_ms, texto, created_at, expires_at, evento_id",
    )
    .in("profile_id", otherIds)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const stories = (storiesRaw ?? []) as StoryRow[];
  if (stories.length === 0) return [];

  const storyIds = stories.map((s) => s.id);
  const uniqAutorIds = Array.from(new Set(stories.map((s) => s.profile_id)));
  const uniqEventoIds = Array.from(
    new Set(stories.map((s) => s.evento_id).filter((x): x is string => !!x)),
  );

  const [viewsRes, profilesRes, fotosRes] = await Promise.all([
    supabase
      .from("stories_views")
      .select("story_id, liked")
      .in("story_id", storyIds)
      .eq("viewer_id", me),
    supabase
      .from("profiles")
      .select("id, nome_exibicao, suspenso, deletado_em")
      .in("id", uniqAutorIds),
    supabase
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", uniqAutorIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
  ]);

  const viewedSet = new Set<string>();
  const likedSet = new Set<string>();
  (viewsRes.data ?? []).forEach((v) => {
    const sid = v.story_id as string;
    viewedSet.add(sid);
    if (v.liked) likedSet.add(sid);
  });

  const nomeByProfile = new Map<string, string>();
  // Profiles suspensos/excluídos: não exibimos seus stories no carrossel
  const profilesBloqueados = new Set<string>();
  (profilesRes.data ?? []).forEach((p) => {
    nomeByProfile.set(p.id as string, (p.nome_exibicao as string) ?? "Perfil");
    if ((p as { suspenso?: boolean }).suspenso) {
      profilesBloqueados.add(p.id as string);
    }
    if ((p as { deletado_em?: string | null }).deletado_em) {
      profilesBloqueados.add(p.id as string);
    }
  });

  const capaByProfile = new Map<string, string>();
  (fotosRes.data ?? []).forEach((f) => {
    const pid = f.profile_id as string;
    if (!capaByProfile.has(pid)) {
      const { data: pu } = supabase.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      capaByProfile.set(pid, pu.publicUrl);
    }
  });

  const mediaMap = await resolveStoriesMedia(stories);

  const eventosMap = new Map<string, { id: string; titulo: string }>();
  if (uniqEventoIds.length > 0) {
    const { data: ev } = await supabase
      .from("eventos")
      .select("id, titulo")
      .in("id", uniqEventoIds);
    (ev ?? []).forEach((e) =>
      eventosMap.set(e.id as string, {
        id: e.id as string,
        titulo: e.titulo as string,
      }),
    );
  }

  const checkinsMap = await loadActiveCheckinsForProfiles(uniqAutorIds);

  const grouped = new Map<string, StoriesBarAutor>();
  for (const s of stories) {
    if (profilesBloqueados.has(s.profile_id)) continue;
    const mediaUrl = mediaMap.get(s.id);
    if (!mediaUrl) continue;
    const autor = grouped.get(s.profile_id) ?? {
      profileId: s.profile_id,
      nome: nomeByProfile.get(s.profile_id) ?? "Perfil",
      capa: capaByProfile.get(s.profile_id) ?? null,
      temNaoVisto: false,
      checkin: checkinsMap.get(s.profile_id) ?? null,
      stories: [],
    };
    autor.stories.push({
      id: s.id,
      mediaUrl,
      mediaTipo: s.media_tipo,
      duracaoMs: s.duracao_ms,
      texto: s.texto,
      createdAt: s.created_at,
      liked: likedSet.has(s.id),
      evento: s.evento_id ? eventosMap.get(s.evento_id) ?? null : null,
    });
    if (!viewedSet.has(s.id)) autor.temNaoVisto = true;
    grouped.set(s.profile_id, autor);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.temNaoVisto === b.temNaoVisto) return 0;
    return a.temNaoVisto ? -1 : 1;
  });
}

/* ====================================================================
 * loadMyStoriesAutor — meus próprios stories ativos como StoriesBarAutor.
 * Usado pra renderizar "Você" no carrossel de stories e permitir
 * que o user veja como ficaram seus posts.
 * ================================================================== */
export async function loadMyStoriesAutor(
  me: string,
): Promise<StoriesBarAutor | null> {
  const supabase = await createClient();

  const { data: storiesRaw } = await supabase
    .from("stories")
    .select(
      "id, profile_id, media_url, media_tipo, duracao_ms, texto, created_at, expires_at, evento_id",
    )
    .eq("profile_id", me)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const stories = (storiesRaw ?? []) as StoryRow[];
  if (stories.length === 0) return null;

  const uniqEventoIds = Array.from(
    new Set(stories.map((s) => s.evento_id).filter((x): x is string => !!x)),
  );
  const eventosMap = new Map<string, { id: string; titulo: string }>();
  if (uniqEventoIds.length > 0) {
    const { data: ev } = await supabase
      .from("eventos")
      .select("id, titulo")
      .in("id", uniqEventoIds);
    (ev ?? []).forEach((e) =>
      eventosMap.set(e.id as string, {
        id: e.id as string,
        titulo: e.titulo as string,
      }),
    );
  }

  const [profileRes, fotosRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("nome_exibicao")
      .eq("id", me)
      .maybeSingle(),
    supabase
      .from("fotos")
      .select("url")
      .eq("profile_id", me)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true })
      .limit(1),
  ]);

  const nome = (profileRes.data?.nome_exibicao as string) ?? "Você";
  let capa: string | null = null;
  const f = fotosRes.data?.[0];
  if (f?.url) {
    const { data: pu } = supabase.storage
      .from("fotos-publicas")
      .getPublicUrl(f.url as string);
    capa = pu.publicUrl;
  }

  const mediaMap = await resolveStoriesMedia(stories);

  const checkinsMap = await loadActiveCheckinsForProfiles([me]);

  return {
    profileId: me,
    nome,
    capa,
    temNaoVisto: false,
    checkin: checkinsMap.get(me) ?? null,
    stories: stories
      .map((s) => {
        const mediaUrl = mediaMap.get(s.id);
        if (!mediaUrl) return null;
        return {
          id: s.id,
          mediaUrl,
          mediaTipo: s.media_tipo,
          duracaoMs: s.duracao_ms,
          texto: s.texto,
          createdAt: s.created_at,
          liked: false,
          evento: s.evento_id ? eventosMap.get(s.evento_id) ?? null : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}
