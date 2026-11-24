"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ====================================================================
 * Server Actions — comentários em fotos
 *  - listComentarios(fotoId)     → lê comentários + autor + likes
 *  - postComentario(fotoId, txt) → cria
 *  - deleteComentario(id)        → autor ou dono da foto pode apagar
 *  - toggleComentarioLike(id)    → curtir/descurtir
 * ================================================================== */

export type ComentarioAutor = {
  id: string;
  nome: string;
  capa: string | null;
};

export type ComentarioItem = {
  id: string;
  fotoId: string;
  texto: string;
  createdAt: string;
  autor: ComentarioAutor;
  likes: number;
  curtiPorMim: boolean;
  podeApagar: boolean;
};

export async function listComentarios(
  fotoId: string,
): Promise<ComentarioItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = adminClient();

  const { data: raw } = await admin
    .from("comentarios_foto")
    .select("id, foto_id, profile_id, texto, created_at")
    .eq("foto_id", fotoId)
    .order("created_at", { ascending: true })
    .limit(200);

  const rows = raw ?? [];
  if (rows.length === 0) return [];

  const profileIds = Array.from(new Set(rows.map((r) => r.profile_id as string)));
  const comentarioIds = rows.map((r) => r.id as string);

  const [profilesRes, fotosRes, likesRes, fotoRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, nome_exibicao")
      .in("id", profileIds),
    admin
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", profileIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
    admin
      .from("comentarios_foto_likes")
      .select("comentario_id, profile_id")
      .in("comentario_id", comentarioIds),
    admin.from("fotos").select("profile_id").eq("id", fotoId).maybeSingle(),
  ]);

  const autorMap = new Map<string, ComentarioAutor>();
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

  const donoFoto = (fotoRes.data?.profile_id as string | undefined) ?? null;

  return rows.map((r) => ({
    id: r.id as string,
    fotoId: r.foto_id as string,
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
      (r.profile_id as string) === user.id || donoFoto === user.id,
  }));
}

export async function postComentario(
  fotoId: string,
  texto: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const clean = texto.trim().slice(0, 280);
  if (!clean) return { error: "Comentário vazio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Usa adminClient para bypass do RLS no INSERT — a autenticação já foi
  // validada acima e profile_id é fixado no userId da sessão.
  const { data, error } = await adminClient()
    .from("comentarios_foto")
    .insert({ foto_id: fotoId, profile_id: user.id, texto: clean })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/app/p");
  return { ok: true, id: data.id as string };
}

export async function deleteComentario(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("comentarios_foto")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function toggleComentarioLike(
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
      .from("comentarios_foto_likes")
      .insert({ comentario_id: comentarioId, profile_id: user.id });
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await admin
      .from("comentarios_foto_likes")
      .delete()
      .eq("comentario_id", comentarioId)
      .eq("profile_id", user.id);
    if (error) return { error: error.message };
  }

  return { ok: true };
}
