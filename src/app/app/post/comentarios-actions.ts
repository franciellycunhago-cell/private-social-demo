"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { createNotificacao } from "@/lib/notificacoes";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit/server";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions — comentários em posts
 *  - listPostComentarios(postId)        → lê comentários + autor + likes
 *  - postPostComentario(postId, txt)    → cria
 *  - deletePostComentario(id)           → autor ou dono do post pode apagar
 *  - togglePostComentarioLike(id)       → curtir/descurtir
 *
 * Mesmo padrão de comentarios-actions das fotos — usa adminClient
 * pra contornar RLS (auth já validada).
 * ================================================================== */

export type PostComentarioAutor = {
  id: string;
  nome: string;
  capa: string | null;
};

export type PostComentarioItem = {
  id: string;
  postId: string;
  texto: string;
  createdAt: string;
  autor: PostComentarioAutor;
  likes: number;
  curtiPorMim: boolean;
  podeApagar: boolean;
};

export async function listPostComentarios(
  postId: string,
): Promise<PostComentarioItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = adminClient();

  const { data: raw } = await admin
    .from("posts_comentarios")
    .select("id, post_id, profile_id, texto, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = raw ?? [];
  if (rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(rows.map((r) => r.profile_id as string)),
  );
  const comentarioIds = rows.map((r) => r.id as string);

  const [profilesRes, fotosRes, likesRes, postRes] = await Promise.all([
    admin.from("profiles").select("id, nome_exibicao").in("id", profileIds),
    admin
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", profileIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
    admin
      .from("posts_comentarios_likes")
      .select("comentario_id, profile_id")
      .in("comentario_id", comentarioIds),
    admin.from("posts").select("profile_id").eq("id", postId).maybeSingle(),
  ]);

  const nomeMap = new Map<string, string>();
  (profilesRes.data ?? []).forEach((p) =>
    nomeMap.set(p.id as string, (p.nome_exibicao as string) ?? "Perfil"),
  );

  const capaMap = new Map<string, string>();
  (fotosRes.data ?? []).forEach((f) => {
    const pid = f.profile_id as string;
    if (!capaMap.has(pid)) {
      const { data } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      capaMap.set(pid, data.publicUrl);
    }
  });

  const autorMap = new Map<string, PostComentarioAutor>();
  profileIds.forEach((pid) => {
    autorMap.set(pid, {
      id: pid,
      nome: nomeMap.get(pid) ?? "Perfil",
      capa: capaMap.get(pid) ?? null,
    });
  });

  const likesCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  (likesRes.data ?? []).forEach((l) => {
    const cid = l.comentario_id as string;
    likesCount.set(cid, (likesCount.get(cid) ?? 0) + 1);
    if (l.profile_id === user.id) likedByMe.add(cid);
  });

  const donoPost =
    (postRes.data?.profile_id as string | undefined) ?? null;

  return rows.map((r) => ({
    id: r.id as string,
    postId: r.post_id as string,
    texto: r.texto as string,
    createdAt: r.created_at as string,
    autor: autorMap.get(r.profile_id as string) ?? {
      id: r.profile_id as string,
      nome: "Perfil",
      capa: null,
    },
    likes: likesCount.get(r.id as string) ?? 0,
    curtiPorMim: likedByMe.has(r.id as string),
    podeApagar:
      (r.profile_id as string) === user.id || donoPost === user.id,
  }));
}

export async function postPostComentario(
  postId: string,
  texto: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const clean = texto.trim().slice(0, 280);
  if (!clean) return { error: "Comentário vazio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const rl = await checkRateLimit("comentario", user.id, { max: 60, windowSec: 3600 });
  if (!rl.ok) {
    return {
      error: `Devagar com os comentários. Tente em ${formatRetryAfter(rl.retryAfterSec)}.`,
    };
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from("posts_comentarios")
    .insert({ post_id: postId, profile_id: user.id, texto: clean })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Fire-and-forget: notifica o dono do post (se não for ele mesmo)
  void (async () => {
    const [{ data: post }, { data: autor }] = await Promise.all([
      admin.from("posts").select("profile_id").eq("id", postId).maybeSingle(),
      admin
        .from("profiles")
        .select("nome_exibicao")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    const donoId = post?.profile_id as string | undefined;
    if (!donoId || donoId === user.id) return;
    const nomeAutor = (autor?.nome_exibicao as string) ?? "Alguém";
    const preview = clean.length > 80 ? clean.slice(0, 77) + "…" : clean;
    await Promise.all([
      sendPushToUser(
        donoId,
        {
          title: `${nomeAutor} comentou no seu post`,
          body: preview,
          url: `/app/p/${user.id}`,
        },
        "comentarios_post",
      ),
      createNotificacao({
        userId: donoId,
        actorId: user.id,
        tipo: "comentou_post",
        postId,
        commentId: data.id as string,
        metadata: { preview },
      }),
    ]);
  })();

  revalidatePath("/app/descobrir");
  return { ok: true, id: data.id as string };
}

export async function deletePostComentario(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const admin = adminClient();
  // Confere autor do comentário OU dono do post
  const { data: c } = await admin
    .from("posts_comentarios")
    .select("profile_id, post_id")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { error: "Comentário não encontrado." };

  const ehAutor = c.profile_id === user.id;
  let ehDonoPost = false;
  if (!ehAutor) {
    const { data: post } = await admin
      .from("posts")
      .select("profile_id")
      .eq("id", c.post_id)
      .maybeSingle();
    ehDonoPost = post?.profile_id === user.id;
  }
  if (!ehAutor && !ehDonoPost) {
    return { error: "Você não pode apagar esse comentário." };
  }

  const { error } = await admin.from("posts_comentarios").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function togglePostComentarioLike(
  comentarioId: string,
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
      .from("posts_comentarios_likes")
      .insert({ comentario_id: comentarioId, profile_id: user.id });
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await admin
      .from("posts_comentarios_likes")
      .delete()
      .eq("comentario_id", comentarioId)
      .eq("profile_id", user.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}
