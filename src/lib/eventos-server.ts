import { createClient } from "./supabase/server";
import type { EventoRow } from "./eventos";

/* ====================================================================
 * Helpers server-only pra eventos. Separado do lib/eventos.ts porque
 * aquele é importado também por client components (ex.: eventos-grid),
 * e client bundle não pode transitivamente incluir `next/headers`.
 * ================================================================== */

export async function resolveEventoFoto(
  fotoUrl: string | null,
): Promise<string | null> {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) {
    return fotoUrl;
  }
  const supabase = await createClient();
  const { data } = supabase.storage.from("eventos").getPublicUrl(fotoUrl);
  return data.publicUrl;
}

export async function resolveEventoFotos(
  eventos: EventoRow[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (eventos.length === 0) return map;
  const supabase = await createClient();
  for (const e of eventos) {
    if (!e.foto_url) continue;
    if (e.foto_url.startsWith("http")) {
      map.set(e.id, e.foto_url);
    } else {
      const { data } = supabase.storage
        .from("eventos")
        .getPublicUrl(e.foto_url);
      map.set(e.id, data.publicUrl);
    }
  }
  return map;
}
