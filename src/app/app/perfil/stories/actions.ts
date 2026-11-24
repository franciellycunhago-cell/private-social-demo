"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Server Actions /app/perfil/stories
 *
 *  - registerStory(path, texto): grava linha em `stories` após upload
 *  - deleteStory(id): apaga linha + objeto
 *  - markStoryViewed(storyId): insere em stories_views (idempotente)
 * ================================================================== */

const MAX_STORIES_24H = 10;

export async function registerStory(
  path: string,
  texto: string | null,
  mediaTipo: "imagem" | "video" = "imagem",
  duracaoMs: number | null = null,
  eventoId: string | null = null,
): Promise<{ ok: true; id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  if (!path.startsWith(`${user.id}/`)) return { error: "Caminho inválido." };

  // Limite: 10 stories ativas
  const { count: ativos } = await supabase
    .from("stories")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .gt("expires_at", new Date().toISOString());

  if (ativos !== null && ativos >= MAX_STORIES_24H) {
    return { error: `Máximo ${MAX_STORIES_24H} stories ativos ao mesmo tempo.` };
  }

  const captionClean = texto?.trim().slice(0, 200) || null;

  const { data, error } = await supabase
    .from("stories")
    .insert({
      profile_id: user.id,
      media_url: path,
      media_tipo: mediaTipo,
      duracao_ms: duracaoMs,
      texto: captionClean,
      evento_id: eventoId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Se marcou evento, faz checkin automático (12h)
  if (eventoId) {
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("checkins")
      .upsert(
        { profile_id: user.id, evento_id: eventoId, expires_at: expires },
        { onConflict: "profile_id,evento_id" },
      );
  }

  revalidatePath("/app/perfil/stories");
  revalidatePath("/app/conversas");
  if (eventoId) revalidatePath(`/app/eventos/${eventoId}`);
  return { ok: true, id: data.id as string };
}

export async function deleteStory(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data: story, error: readErr } = await supabase
    .from("stories")
    .select("id, media_url, profile_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (readErr || !story) return { error: "Story não encontrado." };

  await supabase.storage.from("stories").remove([story.media_url]);
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/app/perfil/stories");
  revalidatePath("/app/conversas");
  return { ok: true };
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("stories_views")
    .insert({ story_id: storyId, viewer_id: user.id });
  // ignora erro 23505 (já viu) silenciosamente
}

export async function setStoryLike(
  storyId: string,
  liked: boolean,
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("set_story_like", {
    p_story_id: storyId,
    p_liked: liked,
  });
  // Invalida o cache do Next pra /app/conversas (onde o viewer abre) e
  // /app/perfil/stories (onde o dono vê o count). Sem isso o Router
  // Cache do client ainda mostra o estado antigo quando o user volta.
  revalidatePath("/app/conversas");
  revalidatePath("/app/perfil/stories");
}

export type StoryViewerInfo = {
  viewerId: string;
  nome: string;
  capa: string | null;
  liked: boolean;
  viewedAt: string;
};

export async function listarViewsDoStory(
  storyId: string,
): Promise<StoryViewerInfo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RLS `stories_views_select_owner_or_self` garante que só o dono do
  // story (ou o próprio viewer) vê essas linhas. A UI chama isso só
  // pro dono — mas a RLS é a verdade.
  const { data: views } = await supabase
    .from("stories_views")
    .select("viewer_id, liked, viewed_at")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });

  const rows = views ?? [];
  if (rows.length === 0) return [];

  const viewerIds = rows.map((r) => r.viewer_id as string);
  const [profilesRes, fotosRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome_exibicao")
      .in("id", viewerIds),
    supabase
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", viewerIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
  ]);

  const nomeMap = new Map<string, string>();
  (profilesRes.data ?? []).forEach((p) =>
    nomeMap.set(p.id as string, (p.nome_exibicao as string) ?? "Perfil"),
  );

  const capaMap = new Map<string, string>();
  (fotosRes.data ?? []).forEach((f) => {
    const pid = f.profile_id as string;
    if (!capaMap.has(pid)) {
      const { data } = supabase.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      capaMap.set(pid, data.publicUrl);
    }
  });

  return rows.map((r) => ({
    viewerId: r.viewer_id as string,
    nome: nomeMap.get(r.viewer_id as string) ?? "Perfil",
    capa: capaMap.get(r.viewer_id as string) ?? null,
    liked: !!r.liked,
    viewedAt: r.viewed_at as string,
  }));
}
