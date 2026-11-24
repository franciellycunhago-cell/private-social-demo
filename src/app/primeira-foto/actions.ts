"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * Server Action /primeira-foto
 *
 * Após a unificação fotos/posts, cada upload nesta tela cria um POST
 * (com texto vazio e a foto anexada). Isso conta pro mínimo de
 * conteúdo e aparece na timeline do user.
 *
 * Se ainda não tem capa setada (profile.foto_capa_path), também seta
 * essa primeira foto como capa.
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type RegisterFirstPhotoResult = { ok?: true; error?: string };

export async function registerFirstPhoto(
  _prev: RegisterFirstPhotoResult | null,
  formData: FormData,
): Promise<RegisterFirstPhotoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou. Faça login de novo." };

  const path = (formData.get("path") ?? "").toString().trim();
  if (!path) return { error: "Caminho do arquivo ausente." };
  if (!path.startsWith(`${user.id}/`)) return { error: "Caminho inválido." };

  // Cria um post novo com texto vazio + 1 foto anexada. Via service role
  // pra contornar possíveis problemas de RLS.
  const admin = adminClient();
  const { data: post, error: postErr } = await admin
    .from("posts")
    .insert({
      profile_id: user.id,
      texto: "",
      likes_count: 0,
      comentarios_count: 0,
    })
    .select("id")
    .single();
  if (postErr || !post) {
    return { error: postErr?.message ?? "Falha ao criar post." };
  }

  const { error: fotoErr } = await admin.from("posts_fotos").insert({
    post_id: post.id,
    url: path,
    ordem: 0,
  });
  if (fotoErr) {
    // Rollback: apaga o post pra não deixar órfão
    await admin.from("posts").delete().eq("id", post.id);
    return { error: fotoErr.message };
  }

  // Se ainda não tem capa, seta esta como capa (boa UX: primeira foto
  // postada vira a capa automaticamente).
  const { data: profile } = await admin
    .from("profiles")
    .select("foto_capa_path")
    .eq("id", user.id)
    .maybeSingle<{ foto_capa_path: string | null }>();
  if (!profile?.foto_capa_path) {
    await admin
      .from("profiles")
      .update({ foto_capa_path: path })
      .eq("id", user.id);
  }

  return { ok: true };
}
