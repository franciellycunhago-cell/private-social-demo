"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Server Actions /admin/eventos
 *
 *  - saveEvento(payload)   — cria ou atualiza
 *  - deleteEvento(id)
 *  - togglePublicado(id, publicado)
 *
 * Toda a validação é enforced pela RLS `eventos_admin_all` (só admin
 * faz write). Aqui só fazemos a chamada + revalidatePath.
 * ================================================================== */

export type EventoFormPayload = {
  id?: string;
  titulo: string;
  descricao: string | null;
  data: string; // ISO
  local: string | null;
  cidade: string | null;
  capacidade: number | null;
  dress_code: string | null;
  tipo: "proprio" | "patrocinado";
  patrocinador_nome: string | null;
  valor_patrocinio: number | null;
  foto_url: string | null;
  vip_only: boolean;
  publicado: boolean;
  destacado: boolean;
};

export type SaveResult =
  | { ok: true; id: string }
  | { error: string };

export async function saveEvento(
  payload: EventoFormPayload,
): Promise<SaveResult> {
  if (!payload.titulo.trim()) return { error: "Título é obrigatório." };
  if (!payload.data) return { error: "Data é obrigatória." };

  const supabase = await createClient();
  const base = {
    titulo: payload.titulo.trim(),
    descricao: payload.descricao?.trim() || null,
    data: payload.data,
    local: payload.local?.trim() || null,
    cidade: payload.cidade?.trim() || null,
    capacidade: payload.capacidade,
    dress_code: payload.dress_code?.trim() || null,
    tipo: payload.tipo,
    patrocinador_nome: payload.patrocinador_nome?.trim() || null,
    valor_patrocinio: payload.valor_patrocinio,
    foto_url: payload.foto_url,
    vip_only: payload.vip_only,
    publicado: payload.publicado,
    destacado: payload.destacado,
  };

  // Regra: só 1 evento destacado por vez. Se esse vai ser destacado,
  // desativa o destaque nos outros antes de salvar.
  if (payload.destacado) {
    const q = supabase
      .from("eventos")
      .update({ destacado: false })
      .eq("destacado", true);
    if (payload.id) q.neq("id", payload.id);
    await q;
  }

  if (payload.id) {
    const { error } = await supabase
      .from("eventos")
      .update(base)
      .eq("id", payload.id);
    if (error) return { error: error.message };
    revalidatePath("/admin/eventos");
    revalidatePath("/app/eventos");
    revalidatePath("/app/descobrir");
    return { ok: true, id: payload.id };
  }

  const { data, error } = await supabase
    .from("eventos")
    .insert(base)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/eventos");
  revalidatePath("/app/eventos");
  revalidatePath("/app/descobrir");
  return { ok: true, id: data.id as string };
}

export async function deleteEvento(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/eventos");
  revalidatePath("/app/eventos");
  revalidatePath("/app/descobrir");
  return { ok: true };
}

export async function togglePublicado(
  id: string,
  publicado: boolean,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("eventos")
    .update({ publicado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/eventos");
  revalidatePath("/app/eventos");
  revalidatePath("/app/descobrir");
  return { ok: true };
}
