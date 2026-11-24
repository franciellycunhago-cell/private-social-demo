import type { SupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * Helper pra resolver a URL pública da capa do perfil.
 *
 * Lógica:
 *  1. Se profiles.foto_capa_path está setado → resolve via getPublicUrl
 *  2. Se null → fallback: primeira foto do post mais antigo do user
 *  3. Se ainda assim nada → retorna null (UI mostra placeholder)
 * ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export function resolveFotoCapaUrlDireto(
  client: AnySupabaseClient,
  fotoCapaPath: string | null,
): string | null {
  if (!fotoCapaPath) return null;
  const { data } = client.storage.from("fotos-publicas").getPublicUrl(fotoCapaPath);
  return data.publicUrl ?? null;
}

/**
 * Resolve a capa de UM perfil. Se foto_capa_path estiver vazio,
 * pega a primeira foto do post mais antigo (fallback).
 */
export async function resolveFotoCapa(
  client: AnySupabaseClient,
  userId: string,
  fotoCapaPath: string | null,
): Promise<string | null> {
  // 1. Direto do foto_capa_path
  if (fotoCapaPath) {
    return resolveFotoCapaUrlDireto(client, fotoCapaPath);
  }

  // 2. Fallback: primeira foto de post (ordenado por created_at asc do post)
  const { data: posts } = await client
    .from("posts")
    .select("id, posts_fotos(url, ordem)")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true })
    .limit(5);

  if (!posts) return null;
  type PostWithFotos = {
    id: string;
    posts_fotos: Array<{ url: string; ordem: number }> | null;
  };
  for (const p of posts as PostWithFotos[]) {
    const fotos = p.posts_fotos ?? [];
    if (fotos.length > 0) {
      // pega a com menor ordem
      const sorted = [...fotos].sort((a, b) => a.ordem - b.ordem);
      const path = sorted[0]?.url;
      if (path) {
        const { data } = client.storage
          .from("fotos-publicas")
          .getPublicUrl(path);
        return data.publicUrl ?? null;
      }
    }
  }

  return null;
}

/**
 * Versão batch: resolve capas de N usuários de uma vez. Usado em listas
 * (feed, busca, admin). Evita N+1.
 */
export async function resolveFotoCapasBatch(
  client: AnySupabaseClient,
  profiles: Array<{ id: string; foto_capa_path: string | null }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (profiles.length === 0) return result;

  const semCapa: string[] = [];

  // 1. Pra quem tem foto_capa_path: resolve direto
  profiles.forEach((p) => {
    if (p.foto_capa_path) {
      const { data } = client.storage
        .from("fotos-publicas")
        .getPublicUrl(p.foto_capa_path);
      if (data.publicUrl) result.set(p.id, data.publicUrl);
    } else {
      semCapa.push(p.id);
    }
  });

  if (semCapa.length === 0) return result;

  // 2. Fallback: pega a primeira foto do primeiro post deles
  const { data: postsRaw } = await client
    .from("posts")
    .select("id, profile_id, created_at")
    .in("profile_id", semCapa)
    .order("created_at", { ascending: true });

  type PostRow = { id: string; profile_id: string; created_at: string };
  const posts = (postsRaw ?? []) as PostRow[];

  // Pega o primeiro post de cada profile
  const primeiroPostDe = new Map<string, string>(); // profile_id → post_id
  posts.forEach((p) => {
    if (!primeiroPostDe.has(p.profile_id)) {
      primeiroPostDe.set(p.profile_id, p.id);
    }
  });

  if (primeiroPostDe.size === 0) return result;

  const postIds = Array.from(primeiroPostDe.values());
  const { data: fotosRaw } = await client
    .from("posts_fotos")
    .select("post_id, url, ordem")
    .in("post_id", postIds)
    .order("ordem", { ascending: true });

  type FotoPost = { post_id: string; url: string; ordem: number };
  const primeiraFotoDePost = new Map<string, string>();
  (fotosRaw ?? []).forEach((f: FotoPost) => {
    if (!primeiraFotoDePost.has(f.post_id)) {
      primeiraFotoDePost.set(f.post_id, f.url);
    }
  });

  primeiroPostDe.forEach((postId, profileId) => {
    const path = primeiraFotoDePost.get(postId);
    if (path) {
      const { data } = client.storage
        .from("fotos-publicas")
        .getPublicUrl(path);
      if (data.publicUrl) result.set(profileId, data.publicUrl);
    }
  });

  return result;
}
