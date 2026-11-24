import { redirect } from "next/navigation";
import { getProfileStatus } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { RadarClient } from "./radar-client";

export const metadata = {
  title: "Radar — PrivateSocial",
};

/* ====================================================================
 * /app/radar
 *
 * Pede permissão de localização, salva no banco, e mostra perfis
 * próximos ordenados por distância. Toggle de visibilidade fica no
 * /app/perfil/ajustes.
 * ================================================================== */

export default async function RadarPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");

  // Carrega o estado atual do toggle pra mostrar feedback se o user
  // está invisível pros outros.
  const supabase = await createClient();
  const { data: meRow } = await supabase
    .from("profiles")
    .select("geo_visivel, geo_atualizado_em")
    .eq("id", info.userId)
    .maybeSingle<{
      geo_visivel: boolean;
      geo_atualizado_em: string | null;
    }>();

  return (
    <RadarClient
      meuVisivel={meRow?.geo_visivel ?? true}
      tinhaGeo={!!meRow?.geo_atualizado_em}
    />
  );
}
