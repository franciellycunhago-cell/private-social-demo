import type { SupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * Helper server-side pra contar "conteúdo com foto" de um usuário.
 *
 * Conta: fotos públicas ativas (fotos table) + publicações com foto
 * (posts que têm pelo menos 1 row em posts_fotos). Quem postou bastante
 * no feed também conta como tendo "se mostrado" — não precisa bloquear.
 *
 * Versão singular e batch (pra admin page que itera N users).
 * ================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/**
 * Conta total de "conteúdos com foto" de UM usuário.
 *  = fotos públicas ativas + publicações que têm fotos
 */
export async function countUserContentFotos(
  client: AnySupabaseClient,
  userId: string,
): Promise<number> {
  const [fotosRes, postsRes] = await Promise.all([
    client
      .from("fotos")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", userId)
      .eq("tipo", "publica")
      .is("deletado_em", null),
    client.from("posts").select("id").eq("profile_id", userId),
  ]);

  const postIds = ((postsRes.data ?? []) as { id: string }[]).map((p) => p.id);
  let postsComFotoCount = 0;
  if (postIds.length > 0) {
    const { data: fotoPosts } = await client
      .from("posts_fotos")
      .select("post_id")
      .in("post_id", postIds);
    const unique = new Set(
      ((fotoPosts ?? []) as { post_id: string }[]).map((f) => f.post_id),
    );
    postsComFotoCount = unique.size;
  }

  return (fotosRes.count ?? 0) + postsComFotoCount;
}

/**
 * Versão batch — recebe N userIds e devolve Map com a contagem total
 * de cada um. Faz só 3 queries no banco no total (não importa quantos
 * users).
 */
export async function countUserContentFotosBatch(
  client: AnySupabaseClient,
  userIds: string[],
): Promise<{
  total: Map<string, number>;
  fotosPerfil: Map<string, number>;
  postsComFoto: Map<string, number>;
}> {
  const total = new Map<string, number>();
  const fotosPerfil = new Map<string, number>();
  const postsComFoto = new Map<string, number>();

  if (userIds.length === 0) {
    return { total, fotosPerfil, postsComFoto };
  }

  const [fotosRes, postsRes] = await Promise.all([
    client
      .from("fotos")
      .select("profile_id")
      .in("profile_id", userIds)
      .eq("tipo", "publica")
      .is("deletado_em", null),
    client.from("posts").select("id, profile_id").in("profile_id", userIds),
  ]);

  // Conta fotos públicas por perfil
  ((fotosRes.data ?? []) as { profile_id: string }[]).forEach((f) => {
    fotosPerfil.set(f.profile_id, (fotosPerfil.get(f.profile_id) ?? 0) + 1);
  });

  // Map post_id → profile_id
  const postToProfile = new Map<string, string>();
  ((postsRes.data ?? []) as { id: string; profile_id: string }[]).forEach((p) => {
    postToProfile.set(p.id, p.profile_id);
  });
  const postIds = Array.from(postToProfile.keys());

  // Distinct post_ids que têm foto
  const postsComFotoSet = new Set<string>();
  if (postIds.length > 0) {
    const { data: fotoPosts } = await client
      .from("posts_fotos")
      .select("post_id")
      .in("post_id", postIds);
    ((fotoPosts ?? []) as { post_id: string }[]).forEach((f) =>
      postsComFotoSet.add(f.post_id),
    );
  }

  // Conta posts-com-foto por perfil
  postsComFotoSet.forEach((postId) => {
    const profileId = postToProfile.get(postId);
    if (profileId) {
      postsComFoto.set(profileId, (postsComFoto.get(profileId) ?? 0) + 1);
    }
  });

  // Soma
  userIds.forEach((uid) => {
    total.set(
      uid,
      (fotosPerfil.get(uid) ?? 0) + (postsComFoto.get(uid) ?? 0),
    );
  });

  return { total, fotosPerfil, postsComFoto };
}
