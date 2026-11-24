"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  setChatAberto,
  setFotoObrigatoria,
} from "@/lib/app-settings/server";

/* ====================================================================
 * Server Actions /admin/configuracoes
 * ================================================================== */

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: adminRow } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  return !!adminRow;
}

export async function toggleChatAberto(formData: FormData): Promise<void> {
  if (!(await ensureAdmin())) return;
  const ativar = formData.get("ativar") === "true";
  await setChatAberto(ativar);
  revalidatePath("/admin/configuracoes");
}

export async function toggleFotoObrigatoria(
  formData: FormData,
): Promise<void> {
  if (!(await ensureAdmin())) return;
  const ativar = formData.get("ativar") === "true";
  await setFotoObrigatoria(ativar);
  revalidatePath("/admin/configuracoes");
}
