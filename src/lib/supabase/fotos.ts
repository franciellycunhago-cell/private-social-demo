import { createClient } from "./server";

/* ====================================================================
 * Helpers para fotos públicas e privadas.
 *
 * - Buckets:
 *     fotos-publicas  → público (getPublicUrl)
 *     fotos-privadas  → privado (createSignedUrl, 10 min)
 * - A RLS da tabela `fotos` já decide se o user pode ler a linha.
 *   Este helper só monta as URLs pro cliente.
 * ================================================================== */

export type FotoRow = {
  id: string;
  profile_id: string;
  url: string;
  tipo: "publica" | "privada";
  ordem: number;
  created_at: string;
  /** Counter denormalizado de curtidas (preenchido pelo trigger curtidas_foto_counter) */
  likes_count?: number;
};

export type FotoComSrc = FotoRow & {
  src: string | null;
  /** Se o user logado curtiu essa foto (preenchido no server da página) */
  curtidoPorMim?: boolean;
};

export const PHOTO_SIGNED_TTL_SEC = 60 * 10;

/**
 * Resolve as URLs das fotos (públicas via public URL, privadas via signed).
 * Aceita uma lista já carregada — não faz fetch de perfil nenhum.
 */
export async function resolvePhotoSrcs(fotos: FotoRow[]): Promise<FotoComSrc[]> {
  if (fotos.length === 0) return [];
  const supabase = await createClient();

  const privadas = fotos.filter((f) => f.tipo === "privada");
  const signedMap = new Map<string, string | null>();

  if (privadas.length > 0) {
    const { data: signed } = await supabase.storage
      .from("fotos-privadas")
      .createSignedUrls(
        privadas.map((f) => f.url),
        PHOTO_SIGNED_TTL_SEC,
      );
    (signed ?? []).forEach((item) => {
      if (item?.path) signedMap.set(item.path, item.signedUrl ?? null);
    });
  }

  return fotos.map((f) => {
    if (f.tipo === "publica") {
      const { data } = supabase.storage.from("fotos-publicas").getPublicUrl(f.url);
      return { ...f, src: data.publicUrl };
    }
    return { ...f, src: signedMap.get(f.url) ?? null };
  });
}

/**
 * Lê todas as fotos de um perfil (a RLS de `fotos` filtra privadas se não
 * tiver pedido aprovado). Retorna já com src resolvido.
 */
export async function listPhotosForProfile(
  profileId: string,
): Promise<FotoComSrc[]> {
  const supabase = await createClient();
  // Tenta com likes_count (depende da migration 20260430000002 ter
  // rodado). Se a coluna não existir ainda, faz fallback pro SELECT
  // antigo pra fotos não sumirem.
  const withLikes = await supabase
    .from("fotos")
    .select("id, profile_id, url, tipo, ordem, created_at, likes_count")
    .eq("profile_id", profileId)
    .is("deletado_em", null)
    .order("tipo", { ascending: true })
    .order("ordem", { ascending: true });

  if (withLikes.error) {
    const fallback = await supabase
      .from("fotos")
      .select("id, profile_id, url, tipo, ordem, created_at")
      .eq("profile_id", profileId)
      .is("deletado_em", null)
      .order("tipo", { ascending: true })
      .order("ordem", { ascending: true });
    return resolvePhotoSrcs((fallback.data ?? []) as FotoRow[]);
  }

  return resolvePhotoSrcs((withLikes.data ?? []) as FotoRow[]);
}
