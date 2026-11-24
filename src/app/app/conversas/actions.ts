"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* ====================================================================
 * Server Actions /app/conversas
 *
 *  - respondPrivateRequest(pedidoId, aprovar)  : pendente → aprovado/negado
 *  - revokePrivateRequest(pedidoId)            : aprovado → negado (revogar)
 *  - reopenPrivateRequest(pedidoId)            : negado → pendente (rever)
 *
 * Em todas, RLS garante que só o alvo do pedido pode mexer.
 * ================================================================== */

export type RespondResult = { ok: true } | { error: string };

export async function respondPrivateRequest(
  pedidoId: string,
  aprovar: boolean,
): Promise<RespondResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const novoStatus = aprovar ? "aprovado" : "negado";

  const { data, error } = await supabase
    .from("pedidos_privado")
    .update({ status: novoStatus })
    .eq("id", pedidoId)
    .eq("alvo_id", user.id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Pedido não encontrado ou já respondido." };

  revalidatePath("/app/conversas");
  revalidatePath("/app/perfil/pedidos");
  return { ok: true };
}

export async function revokePrivateRequest(
  pedidoId: string,
): Promise<RespondResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data, error } = await supabase
    .from("pedidos_privado")
    .update({ status: "negado" })
    .eq("id", pedidoId)
    .eq("alvo_id", user.id)
    .eq("status", "aprovado")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Pedido não encontrado." };

  revalidatePath("/app/conversas");
  revalidatePath("/app/perfil/pedidos");
  return { ok: true };
}

export async function reopenPrivateRequest(
  pedidoId: string,
): Promise<RespondResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data, error } = await supabase
    .from("pedidos_privado")
    .update({ status: "pendente" })
    .eq("id", pedidoId)
    .eq("alvo_id", user.id)
    .eq("status", "negado")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Pedido não encontrado." };

  revalidatePath("/app/conversas");
  revalidatePath("/app/perfil/pedidos");
  return { ok: true };
}
