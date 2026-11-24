"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Action — listar quem curtiu um post
 *  - listPostLikes(postId)
 *
 * Retorna lista de profiles que curtiram, com capa + cidade + idade.
 * Filtra suspensos/excluídos.
 *
 * Usa adminClient pra contornar RLS — RLS de posts_likes deixa todo
 * mundo ler então não tem segredo, só simplifica.
 * ================================================================== */

export type PostLikeItem = {
  profileId: string;
  nome: string;
  handle: string | null;
  cidade: string;
  idades: string;
  verificado: boolean;
  vip: boolean;
  capa: string | null;
  curtidoEm: string;
};

type LikeRow = {
  profile_id: string;
  created_at: string;
};

type ProfileLite = {
  id: string;
  nome_exibicao: string | null;
  handle: string | null;
  cidade: string | null;
  estado: string | null;
  idade_1: number | null;
  idade_2: number | null;
  verificado: boolean;
  vip_ate: string | null;
  suspenso: boolean;
  deletado_em: string | null;
};

export async function listPostLikes(
  postId: string,
): Promise<PostLikeItem[]> {
  const admin = adminClient();

  const { data: likesRaw } = await admin
    .from("posts_likes")
    .select("profile_id, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(200);

  const likes = (likesRaw ?? []) as LikeRow[];
  if (likes.length === 0) return [];

  const profileIds = Array.from(new Set(likes.map((l) => l.profile_id)));

  const [profilesRes, fotosRes] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, nome_exibicao, handle, cidade, estado, idade_1, idade_2, verificado, vip_ate, suspenso, deletado_em",
      )
      .in("id", profileIds),
    admin
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", profileIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
  ]);

  const profileMap = new Map<string, ProfileLite>();
  ((profilesRes.data ?? []) as ProfileLite[]).forEach((p) => {
    // Esconde suspensos/excluídos
    if (p.suspenso || p.deletado_em) return;
    profileMap.set(p.id, p);
  });

  const fotoMap = new Map<string, string>();
  ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
    (f) => {
      if (!fotoMap.has(f.profile_id)) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url);
        fotoMap.set(f.profile_id, data.publicUrl);
      }
    },
  );

  return likes
    .map((l): PostLikeItem | null => {
      const perfil = profileMap.get(l.profile_id);
      if (!perfil) return null;
      const cidade = [perfil.cidade, perfil.estado].filter(Boolean).join(", ");
      const idades = formatIdades(perfil.idade_1, perfil.idade_2);
      const isVip = perfil.vip_ate
        ? new Date(perfil.vip_ate) > new Date()
        : false;
      return {
        profileId: perfil.id,
        nome: perfil.nome_exibicao ?? "Perfil",
        handle: perfil.handle,
        cidade,
        idades,
        verificado: perfil.verificado,
        vip: isVip,
        capa: fotoMap.get(perfil.id) ?? null,
        curtidoEm: l.created_at,
      };
    })
    .filter((x): x is PostLikeItem => x !== null);
}

function formatIdades(a: number | null, b: number | null): string {
  if (a && b) return `${a}·${b}`;
  if (a) return `${a}`;
  return "";
}
