import { createClient } from "./server";

/* ====================================================================
 * Status de onboarding/verificação do perfil autenticado
 * Usado pelas páginas pra decidir pra onde redirecionar o usuário.
 *
 *   signup       → profiles.tipo is null                      → /onboarding
 *   onboarded    → profiles.tipo preenchido, sem verificacao  → /verificacao
 *   pendente     → verificacao status='pendente'              → /verificacao (tela aguardando)
 *   rejeitado    → verificacao status='rejeitado' (última)    → /verificacao (tela rejeitado)
 *   aprovado     → profiles.verificado=true                   → /app
 * ================================================================== */

export type ProfileTipo = "casal" | "homem" | "mulher";
export type Experiencia = "curioso" | "iniciante" | "experiente" | "veterano";
export type VerificacaoStatus = "pendente" | "aprovado" | "rejeitado";

export type ProfileRow = {
  id: string;
  handle: string | null;
  tipo: ProfileTipo | null;
  nome_exibicao: string | null;
  idade_1: number | null;
  idade_2: number | null;
  cidade: string | null;
  estado: string | null;
  bio: string | null;
  experiencia: Experiencia | null;
  intencoes: string[];
  limites: string[];
  verificado: boolean;
  trust_score: number;
  vip_ate: string | null;
  ultimo_ativo: string | null;
  verificado_em: string | null;
  created_at: string | null;
  foto_capa_path: string | null;
};

export const PROFILE_COLS =
  "id, handle, tipo, nome_exibicao, idade_1, idade_2, cidade, estado, bio, experiencia, intencoes, limites, verificado, trust_score, vip_ate, ultimo_ativo, verificado_em, created_at, foto_capa_path";

export type VerificacaoRow = {
  id: string;
  profile_id: string;
  foto_url: string;
  status: VerificacaoStatus;
  motivo_rejeicao: string | null;
  created_at: string;
};

export type OnboardingData = {
  tipo: ProfileTipo;
  nome_exibicao: string;
  idade_1: number;
  idade_2: number | null;
  cidade: string;
  estado: string | null;
  experiencia: Experiencia;
  bio: string | null;
  intencoes: string[];
  limites: string[];
  telefone: string;
};

export type ProfileStatus =
  | { state: "signup"; profile: ProfileRow }
  | { state: "onboarded"; profile: ProfileRow }
  | { state: "pendente"; profile: ProfileRow; verificacao: VerificacaoRow }
  | { state: "rejeitado"; profile: ProfileRow; verificacao: VerificacaoRow }
  | { state: "aprovado"; profile: ProfileRow }
  | { state: "suspenso"; profile: ProfileRow; motivo: string | null }
  | { state: "deletado"; profile: ProfileRow; deletadoEm: string };

export async function getProfileStatus(): Promise<{
  userId: string;
  email: string | null;
  status: ProfileStatus;
  isAdmin: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  // Se o profile não existe (falha no trigger), cria agora
  let row = profile;
  if (!row) {
    const { data: inserted } = await supabase
      .from("profiles")
      .insert({ id: user.id })
      .select(PROFILE_COLS)
      .single<ProfileRow>();
    row = inserted ?? null;
  }

  if (!row) {
    return null;
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  // Admin = VIP automático: sobrescreve vip_ate pra data muito futura
  // se o user é admin. Decisão produto 27/04/26 — admin tem acesso
  // completo VIP sem precisar de assinatura. Evita ter que repetir
  // checagem isAdmin em todo lugar que verifica vip_ate.
  if (isAdmin) {
    row.vip_ate = "2099-12-31T23:59:59Z";
  }

  // Bloqueio: confere suspensão e soft delete antes de qualquer outra coisa.
  // Suspensos e deletados não acessam o app — paginas chamam getProfileStatus
  // e redirecionam pra /suspenso ou /excluido.
  const { data: statusRow } = await supabase
    .from("profiles")
    .select("suspenso, suspenso_motivo, deletado_em")
    .eq("id", user.id)
    .maybeSingle<{
      suspenso: boolean;
      suspenso_motivo: string | null;
      deletado_em: string | null;
    }>();

  let status: ProfileStatus;

  if (statusRow?.deletado_em) {
    status = {
      state: "deletado",
      profile: row,
      deletadoEm: statusRow.deletado_em,
    };
    return {
      userId: user.id,
      email: user.email ?? null,
      status,
      isAdmin,
    };
  }

  if (statusRow?.suspenso) {
    status = {
      state: "suspenso",
      profile: row,
      motivo: statusRow.suspenso_motivo ?? null,
    };
    return {
      userId: user.id,
      email: user.email ?? null,
      status,
      isAdmin,
    };
  }

  if (row.verificado) {
    status = { state: "aprovado", profile: row };
  } else if (!row.tipo) {
    status = { state: "signup", profile: row };
  } else {
    // Onboarding feito: checa última verificação enviada
    const { data: verif } = await supabase
      .from("verificacoes")
      .select("id, profile_id, foto_url, status, motivo_rejeicao, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<VerificacaoRow>();

    if (!verif) {
      status = { state: "onboarded", profile: row };
    } else if (verif.status === "pendente") {
      status = { state: "pendente", profile: row, verificacao: verif };
    } else if (verif.status === "rejeitado") {
      status = { state: "rejeitado", profile: row, verificacao: verif };
    } else {
      // aprovado mas profile.verificado=false? Trate como aprovado (admin
      // deveria ter setado verificado=true no mesmo update; fallback seguro).
      status = { state: "aprovado", profile: row };
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    status,
    isAdmin,
  };
}

/**
 * Rota ideal para o estado atual do usuário. /app significa "já verificado,
 * pode usar o produto".
 */
export function routeForStatus(status: ProfileStatus["state"]): string {
  switch (status) {
    case "signup":
      return "/onboarding";
    case "onboarded":
      return "/verificacao";
    case "pendente":
    case "rejeitado":
      return "/verificacao";
    case "aprovado":
      return "/app";
    case "suspenso":
      return "/suspenso";
    case "deletado":
      return "/excluido";
  }
}
