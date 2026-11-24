"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/* ====================================================================
 * Server actions /app/radar
 *
 *  - salvarMinhaLocalizacao(lat, lng): grava a posição do user
 *    autenticado em profiles.geo_loc (geography Point) e timestamp.
 *  - buscarRadar(lat, lng, raioKm): chama a RPC radar_perfis_proximos
 *    e retorna a lista já com capa resolvida.
 *  - toggleRadarVisibilidade(visivel): liga/desliga o flag
 *    profiles.geo_visivel (default ligado).
 *
 * Privacidade:
 *  - O cliente NUNCA recebe lat/lng dos outros — só distância.
 *  - geo_loc só é gravada se geo_visivel=true (passa o flag pra
 *    salvar). Se o user desligou, não salva nada novo.
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type SalvarLocResult = { ok: true } | { error: string };

export async function salvarMinhaLocalizacao(
  lat: number,
  lng: number,
): Promise<SalvarLocResult> {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { error: "Coordenadas inválidas." };
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Coordenadas inválidas." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordenadas fora dos limites." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // IMPORTANTE: usa o client com auth do user (não service role) pra
  // que auth.uid() dentro da RPC retorne o id do user. A RPC tem
  // SECURITY DEFINER (precisa pra ST_MakePoint), mas valida que
  // p_user_id == auth.uid() — então tem que ter JWT do user.
  const { error } = await supabase.rpc("set_minha_geo", {
    p_user_id: user.id,
    p_lat: lat,
    p_lng: lng,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export type RadarPerfil = {
  id: string;
  nome: string;
  handle: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string | null;
  idades: string;
  verificado: boolean;
  vip: boolean;
  capa: string | null;
  distanciaKm: number;
};

export type BuscarRadarResult =
  | { ok: true; perfis: RadarPerfil[] }
  | { error: string };

export async function buscarRadar(
  lat: number,
  lng: number,
  raioKm = 50,
  limit = 50,
): Promise<BuscarRadarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { data, error } = await supabase.rpc("radar_perfis_proximos", {
    p_lat: lat,
    p_lng: lng,
    p_raio_km: raioKm,
    p_limit: limit,
  });

  if (error) return { error: error.message };

  type RpcRow = {
    profile_id: string;
    nome_exibicao: string | null;
    handle: string | null;
    tipo: "casal" | "homem" | "mulher" | null;
    cidade: string | null;
    estado: string | null;
    idade_1: number | null;
    idade_2: number | null;
    verificado: boolean;
    vip_ate: string | null;
    distancia_m: number;
  };

  const rows = (data ?? []) as RpcRow[];
  if (rows.length === 0) return { ok: true, perfis: [] };

  // Resolve capas via service role (bypass RLS, mais rápido)
  const admin = adminClient();
  const ids = rows.map((r) => r.profile_id);
  const { data: capasRows } = await admin
    .from("fotos")
    .select("profile_id, url, ordem")
    .in("profile_id", ids)
    .eq("tipo", "publica")
    .order("ordem", { ascending: true });

  const capaMap = new Map<string, string>();
  (capasRows ?? []).forEach((f) => {
    const pid = f.profile_id as string;
    if (!capaMap.has(pid)) {
      const { data: pub } = admin.storage
        .from("fotos-publicas")
        .getPublicUrl(f.url as string);
      capaMap.set(pid, pub.publicUrl);
    }
  });

  const perfis: RadarPerfil[] = rows.map((r) => {
    const idades =
      r.idade_1 && r.idade_2
        ? `${r.idade_1} · ${r.idade_2}`
        : r.idade_1
          ? `${r.idade_1}`
          : "";
    const cidade = [r.cidade, r.estado].filter(Boolean).join(", ");
    return {
      id: r.profile_id,
      nome: r.nome_exibicao ?? "Perfil",
      handle: r.handle,
      tipo: r.tipo,
      cidade: cidade || null,
      idades,
      verificado: r.verificado,
      vip: r.vip_ate ? new Date(r.vip_ate) > new Date() : false,
      capa: capaMap.get(r.profile_id) ?? null,
      distanciaKm: Math.max(0, r.distancia_m / 1000),
    };
  });

  return { ok: true, perfis };
}

export async function toggleRadarVisibilidade(
  visivel: boolean,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  const { error } = await supabase
    .from("profiles")
    .update({ geo_visivel: visivel })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { ok: true };
}
