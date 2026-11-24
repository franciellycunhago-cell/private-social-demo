"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { hasVipAccess } from "@/lib/vip/check";
import { getChatAberto } from "@/lib/app-settings/server";
import { createNotificacao } from "@/lib/notificacoes";

/* ====================================================================
 * Server Actions /app/p/[id]
 *
 *  - requestPrivateAccess(alvoId): insere pedido em `pedidos_privado`
 *  - respondPrivateAccess(pedidoId, aprovado): quando eu sou o alvo
 *  - openChatWith(alvoId): cria match (e conversa via trigger) com
 *    qualquer user. Permitido pra admin sempre; pra users comuns,
 *    apenas quando app_settings.chat_aberto = true (modo early stage).
 *  - togglePhotoLike(fotoId): curte/descurte uma foto (pública ou
 *    privada) do perfil. Notifica dono na primeira curtida.
 * ================================================================== */

export type RequestAccessResult = { ok: true } | { error: string };

export async function requestPrivateAccess(
  alvoId: string,
): Promise<RequestAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === alvoId) return { error: "Não faz sentido pra você mesmo." };

  // Free: máximo 1 pedido_privado ativo (status pendente OU aprovado)
  // por vez. Admin e VIP não têm limite.
  const [meuPerfilRes, adminRow] = await Promise.all([
    supabase
      .from("profiles")
      .select("vip_ate")
      .eq("id", user.id)
      .maybeSingle<{ vip_ate: string | null }>(),
    supabase
      .from("admins")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const isAdmin = !!adminRow.data;
  const isVip = hasVipAccess(meuPerfilRes.data?.vip_ate ?? null, isAdmin);

  if (!isVip) {
    // Conta pedidos ativos (pendente ou aprovado) que NÃO sejam pra esse mesmo alvo
    // (se já pediu pra esse alvo, pode tentar de novo sem ser bloqueado)
    const { count: ativos } = await supabase
      .from("pedidos_privado")
      .select("*", { count: "exact", head: true })
      .eq("solicitante_id", user.id)
      .in("status", ["pendente", "aprovado"])
      .neq("alvo_id", alvoId);

    if (ativos !== null && ativos >= 1) {
      return {
        error:
          "Você já tem um pedido ativo. Cancele o atual ou vire VIP pra pedir pra mais pessoas.",
      };
    }
  }

  const { error } = await supabase
    .from("pedidos_privado")
    .insert({ solicitante_id: user.id, alvo_id: alvoId });

  if (error && error.code !== "23505") {
    return { error: error.message };
  }
  revalidatePath(`/app/p/${alvoId}`);
  return { ok: true };
}

export type LikeFromProfileResult =
  | { matched: true; matchId: string }
  | { matched: false; liked: true }
  | { error: string };

export async function likeFromProfile(
  alvoId: string,
): Promise<LikeFromProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === alvoId) return { error: "Ops, esse é você." };

  const { error } = await supabase
    .from("curtidas")
    .insert({ de_id: user.id, para_id: alvoId, tipo: "like" });

  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  const a = user.id < alvoId ? user.id : alvoId;
  const b = user.id < alvoId ? alvoId : user.id;
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("profile_1", a)
    .eq("profile_2", b)
    .maybeSingle();

  revalidatePath(`/app/p/${alvoId}`);
  if (match?.id) return { matched: true, matchId: match.id };
  return { matched: false, liked: true };
}

export type OpenChatResult =
  | { ok: true; matchId: string }
  | { error: string };

export async function openChatWith(
  alvoId: string,
): Promise<OpenChatResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };
  if (user.id === alvoId) return { error: "Não faz sentido pra você mesmo." };

  // Verifica permissão: admin sempre pode; user comum só quando
  // chat_aberto = true. Checagem server-side — não confia no client.
  const [adminRowRes, chatAberto] = await Promise.all([
    supabase
      .from("admins")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle(),
    getChatAberto(),
  ]);

  const isAdmin = !!adminRowRes.data;
  if (!isAdmin && !chatAberto) {
    return { error: "Chat aberto está desativado no momento." };
  }

  // Par canônico (profile_1 < profile_2) — constraint da tabela matches
  const p1 = user.id < alvoId ? user.id : alvoId;
  const p2 = user.id < alvoId ? alvoId : user.id;

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Cria match (trigger create_conversa_for_match cria a conversa).
  // Se já existe, upsert ignora.
  const { error: insertError } = await admin
    .from("matches")
    .upsert(
      { profile_1: p1, profile_2: p2 },
      { onConflict: "profile_1,profile_2", ignoreDuplicates: true },
    );

  if (insertError) return { error: insertError.message };

  // Recupera o matchId (recém-criado ou pré-existente)
  const { data: match } = await admin
    .from("matches")
    .select("id")
    .eq("profile_1", p1)
    .eq("profile_2", p2)
    .maybeSingle();

  if (!match?.id) return { error: "Falha ao abrir conversa." };
  return { ok: true, matchId: match.id as string };
}

export type TogglePhotoLikeResult =
  | { ok: true; curtido: boolean; total: number }
  | { error: string };

export async function togglePhotoLike(
  fotoId: string,
): Promise<TogglePhotoLikeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Carrega a foto pra saber dono e tipo (pra notificar e revalidar path)
  const { data: foto } = await supabase
    .from("fotos")
    .select("id, profile_id, tipo")
    .eq("id", fotoId)
    .maybeSingle<{
      id: string;
      profile_id: string;
      tipo: "publica" | "privada";
    }>();
  if (!foto) return { error: "Foto não encontrada." };

  // Checa se já curtiu — se sim, descurte; se não, curte
  const { data: existing } = await supabase
    .from("curtidas_foto")
    .select("foto_id")
    .eq("foto_id", fotoId)
    .eq("profile_id", user.id)
    .maybeSingle();

  // Admin curte normalmente (decisão produto 30/04 revisada — Admin
  // quer interagir com seus conhecidos pelas curtidas pra eles
  // sentirem-se vistos). Modo invisível só vale pra visitas de perfil.
  if (existing) {
    const { error } = await supabase
      .from("curtidas_foto")
      .delete()
      .eq("foto_id", fotoId)
      .eq("profile_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("curtidas_foto")
      .insert({ foto_id: fotoId, profile_id: user.id });
    if (error && error.code !== "23505") return { error: error.message };

    // Notifica dono da foto (helper já filtra próprio user)
    void createNotificacao({
      userId: foto.profile_id,
      actorId: user.id,
      tipo: "curtiu_foto",
      fotoId: foto.id,
    });
  }

  // Pega o counter atualizado pelo trigger
  const { data: updated } = await supabase
    .from("fotos")
    .select("likes_count")
    .eq("id", fotoId)
    .maybeSingle<{ likes_count: number }>();

  revalidatePath(`/app/p/${foto.profile_id}`);
  if (foto.profile_id === user.id) {
    revalidatePath("/app/perfil");
  }

  return {
    ok: true,
    curtido: !existing,
    total: updated?.likes_count ?? 0,
  };
}

export type LoadPhotoLikersResult =
  | {
      ok: true;
      likers: Array<{
        id: string;
        nome: string;
        handle: string | null;
        capa: string | null;
        verificado: boolean;
        vip: boolean;
      }>;
    }
  | { error: string };

export async function loadPhotoLikers(
  fotoId: string,
): Promise<LoadPhotoLikersResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data: rows } = await supabase
    .from("curtidas_foto")
    .select("profile_id, created_at")
    .eq("foto_id", fotoId)
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = (rows ?? []).map((r) => r.profile_id as string);
  if (ids.length === 0) return { ok: true, likers: [] };

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [profilesRes, capasRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, nome_exibicao, handle, verificado, vip_ate")
      .in("id", ids),
    admin
      .from("fotos")
      .select("profile_id, url, ordem")
      .in("profile_id", ids)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
  ]);

  const capaMap = new Map<string, string>();
  (capasRes.data ?? []).forEach((f) => {
    const pid = f.profile_id as string;
    if (!capaMap.has(pid)) {
      const { data } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      capaMap.set(pid, data.publicUrl);
    }
  });

  type ProfLite = {
    id: string;
    nome_exibicao: string | null;
    handle: string | null;
    verificado: boolean;
    vip_ate: string | null;
  };
  const profsMap = new Map<string, ProfLite>();
  ((profilesRes.data ?? []) as ProfLite[]).forEach((p) =>
    profsMap.set(p.id, p),
  );

  // Mantém ordem dos curtidores (mais recente primeiro)
  const likers = ids
    .map((id) => {
      const p = profsMap.get(id);
      if (!p) return null;
      return {
        id: p.id,
        nome: p.nome_exibicao ?? "Perfil",
        handle: p.handle,
        capa: capaMap.get(p.id) ?? null,
        verificado: p.verificado,
        vip: p.vip_ate ? new Date(p.vip_ate) > new Date() : false,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { ok: true, likers };
}
