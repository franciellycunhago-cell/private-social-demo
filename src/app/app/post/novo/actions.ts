"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit/server";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions /app/post/novo
 *
 *  - createPost(texto, paths[]) : cria 1 post POR FOTO (sem carrossel).
 *    Se houver texto, vai no PRIMEIRO post. As demais fotos viram
 *    posts separados sem texto. Se for só texto (sem foto), cria 1 post.
 *  - deletePost(id) : remove post (CASCADE leva fotos/likes/comentários)
 *    e apaga os objetos do storage.
 * ================================================================== */

const MAX_FOTOS = 10;
const MAX_TEXTO = 500;

export async function createPost(
  texto: string,
  paths: string[],
): Promise<{ ok: true; ids: string[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const cleanTexto = (texto ?? "").trim().slice(0, MAX_TEXTO);
  const cleanPaths = (paths ?? []).filter(
    (p) => typeof p === "string" && p.startsWith(`${user.id}/`),
  );

  if (cleanPaths.length === 0 && !cleanTexto) {
    return { error: "Adicione pelo menos uma foto ou um texto." };
  }
  if (cleanPaths.length > MAX_FOTOS) {
    return { error: `Máximo de ${MAX_FOTOS} fotos por publicação.` };
  }

  const rl = await checkRateLimit("post", user.id, { max: 30, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Você publicou muitos posts em pouco tempo. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const admin = adminClient();

  // Confere se está verificado (RLS já valida, mas dá erro mais claro aqui)
  const { data: prof } = await admin
    .from("profiles")
    .select("verificado")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.verificado) {
    return { error: "Só perfis verificados podem postar." };
  }

  const createdIds: string[] = [];

  // Caso 1: só texto, sem foto → cria 1 post
  if (cleanPaths.length === 0) {
    const { data: post, error: postErr } = await admin
      .from("posts")
      .insert({ profile_id: user.id, texto: cleanTexto })
      .select("id")
      .single();
    if (postErr || !post) {
      return { error: postErr?.message ?? "Falha ao criar post." };
    }
    createdIds.push(post.id as string);
  } else {
    // Caso 2: 1+ fotos → cria 1 post por foto. Texto vai só na primeira.
    // created_at decrescente (post[0] mais recente) pra preservar ordem
    // de seleção: a primeira foto selecionada aparece no topo do feed.
    const now = Date.now();
    for (let i = 0; i < cleanPaths.length; i++) {
      const path = cleanPaths[i] as string;
      const isFirst = i === 0;
      const createdAt = new Date(now - i).toISOString();

      const { data: post, error: postErr } = await admin
        .from("posts")
        .insert({
          profile_id: user.id,
          texto: isFirst ? cleanTexto : "",
          created_at: createdAt,
        })
        .select("id")
        .single();
      if (postErr || !post) {
        // Rollback: apaga todos os posts já criados nessa chamada
        if (createdIds.length > 0) {
          await admin.from("posts").delete().in("id", createdIds);
        }
        return { error: postErr?.message ?? "Falha ao criar post." };
      }

      const { error: fotoErr } = await admin.from("posts_fotos").insert({
        post_id: post.id as string,
        url: path,
        ordem: 0,
      });
      if (fotoErr) {
        // Rollback completo
        await admin.from("posts").delete().in("id", [...createdIds, post.id as string]);
        return { error: fotoErr.message };
      }
      createdIds.push(post.id as string);
    }
  }

  revalidatePath("/app/descobrir");
  revalidatePath("/app/perfil");
  revalidatePath(`/app/p/${user.id}`);

  return { ok: true, ids: createdIds };
}

export async function deletePost(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();

  const { data: post } = await admin
    .from("posts")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!post) return { error: "Post não encontrado." };
  if (post.profile_id !== user.id) {
    return { error: "Você não pode apagar esse post." };
  }

  // Pega todos os paths de foto pra apagar do storage
  const { data: fotos } = await admin
    .from("posts_fotos")
    .select("url")
    .eq("post_id", id);

  const paths = (fotos ?? []).map((f) => f.url as string);
  if (paths.length > 0) {
    await admin.storage.from("fotos-publicas").remove(paths);
  }

  const { error } = await admin.from("posts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/app/descobrir");
  revalidatePath("/app/perfil");
  revalidatePath(`/app/p/${user.id}`);

  return { ok: true };
}
