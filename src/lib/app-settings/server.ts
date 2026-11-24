import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * app_settings — feature flags e configs runtime
 *
 * Tabela key/value (jsonb). Admin altera pelo /admin/configuracoes
 * sem precisar deploy. Hoje usado pra:
 *  - chat_aberto: libera botão "Conversar" no perfil pra todo mundo,
 *    não só pra quem já tem match.
 *  - foto_obrigatoria: força user a postar 1 foto pública antes de
 *    usar o /app. Sem foto, é redirecionado pra /primeira-foto.
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getChatAberto(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "chat_aberto")
    .maybeSingle<{ value: unknown }>();
  // value é jsonb — pode vir como boolean direto
  return data?.value === true;
}

export async function setChatAberto(open: boolean): Promise<void> {
  const admin = adminClient();
  await admin
    .from("app_settings")
    .upsert(
      { key: "chat_aberto", value: open, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}

export async function getFotoObrigatoria(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "foto_obrigatoria")
    .maybeSingle<{ value: unknown }>();
  return data?.value === true;
}

export async function setFotoObrigatoria(req: boolean): Promise<void> {
  const admin = adminClient();
  await admin
    .from("app_settings")
    .upsert(
      {
        key: "foto_obrigatoria",
        value: req,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}
