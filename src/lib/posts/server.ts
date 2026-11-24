import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type ProfilePost = {
  id: string;
  texto: string;
  createdAt: string;
  likes: number;
  comentarios: number;
  curtiPorMim: boolean;
  fotos: { id: string; src: string }[];
};

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * loadPostsByProfile — carrega posts de um perfil com fotos resolvidas
 * (URLs públicas) e flag `curtiPorMim` baseada em `viewerId`.
 *
 * Usa adminClient pra contornar RLS (já validamos auth nos pages).
 * ================================================================== */

export async function loadPostsByProfile(
  profileId: string,
  viewerId: string,
  limit = 60,
): Promise<ProfilePost[]> {
  const admin = adminClient();

  const { data: postsRaw } = await admin
    .from("posts")
    .select("id, texto, likes_count, comentarios_count, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const posts = (postsRaw ?? []) as Array<{
    id: string;
    texto: string;
    likes_count: number;
    comentarios_count: number;
    created_at: string;
  }>;

  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  const [fotosRes, meusLikesRes] = await Promise.all([
    admin
      .from("posts_fotos")
      .select("id, post_id, url, ordem")
      .in("post_id", postIds)
      .order("ordem", { ascending: true }),
    admin
      .from("posts_likes")
      .select("post_id")
      .eq("profile_id", viewerId)
      .in("post_id", postIds),
  ]);

  const fotosByPost = new Map<string, { id: string; src: string }[]>();
  (fotosRes.data ?? []).forEach((f) => {
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

  return posts.map(
    (p): ProfilePost => ({
      id: p.id,
      texto: p.texto,
      createdAt: p.created_at,
      likes: p.likes_count,
      comentarios: p.comentarios_count,
      curtiPorMim: likedSet.has(p.id),
      fotos: fotosByPost.get(p.id) ?? [],
    }),
  );
}
