import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus, PROFILE_COLS } from "@/lib/supabase/profile";
import type { ProfileRow } from "@/lib/supabase/profile";
import { calcularCompatibilidade } from "@/lib/compatibilidade";
import { Chat, type MensagemRow, type ChatOutro } from "./chat";

export const metadata = {
  title: "Chat — PrivateSocial",
};

type Params = Promise<{ matchId: string }>;

/* ====================================================================
 * /app/conversas/[matchId]
 *
 * Chat 1-a-1 entre dois matches.
 *  - Valida que o user faz parte do match
 *  - Garante que a conversa existe (trigger já cria, mas fallback)
 *  - Carrega últimas 50 mensagens + capa + status do outro
 *  - Renderiza <Chat> (client) que abre o canal Realtime
 * ================================================================== */

const LIMITE_MENSAGENS = 50;

export default async function ChatPage({ params }: { params: Params }) {
  const { matchId } = await params;

  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, profile_1, profile_2, created_at")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) notFound();
  if (match.profile_1 !== meId && match.profile_2 !== meId) notFound();

  const outroId =
    match.profile_1 === meId ? match.profile_2 : match.profile_1;

  // Garante que a conversa existe (fallback caso o trigger não tenha rodado)
  let { data: conversa } = await supabase
    .from("conversas")
    .select("id, match_id, ultima_mensagem_em")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!conversa) {
    const { data: inserted } = await supabase
      .from("conversas")
      .insert({ match_id: matchId })
      .select("id, match_id, ultima_mensagem_em")
      .single();
    conversa = inserted;
  }

  if (!conversa) notFound();

  const [profileRes, meuProfileRes, capaRes, minhaCapaRes, mensagensRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_COLS)
        .eq("id", outroId)
        .maybeSingle<ProfileRow>(),
      supabase
        .from("profiles")
        .select(PROFILE_COLS)
        .eq("id", meId)
        .maybeSingle<ProfileRow>(),
      supabase
        .from("fotos")
        .select("url")
        .eq("profile_id", outroId)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("fotos")
        .select("url")
        .eq("profile_id", meId)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle(),
      // CRÍTICO: order DESC pra pegar as MAIS RECENTES; depois
      // invertemos pra render chronological. Antes era ascending+limit
      // que retornava as mais ANTIGAS — em conversas com >50 msgs as
      // novas (incluindo fotos recém-enviadas) NÃO apareciam após
      // refresh, dando impressão de "foto sumindo".
      supabase
        .from("mensagens")
        .select(
          "id, conversa_id, de_id, texto, tipo, anexo_url, lido, created_at",
        )
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE_MENSAGENS),
    ]);

  if (!profileRes.data) notFound();

  // Capa do outro + minha capa (pro botão de quebrar o gelo)
  let capaUrl: string | null = null;
  if (capaRes.data?.url) {
    const { data } = supabase.storage
      .from("fotos-publicas")
      .getPublicUrl(capaRes.data.url as string);
    capaUrl = data.publicUrl;
  }

  let minhaCapaUrl: string | null = null;
  if (minhaCapaRes.data?.url) {
    const { data } = supabase.storage
      .from("fotos-publicas")
      .getPublicUrl(minhaCapaRes.data.url as string);
    minhaCapaUrl = data.publicUrl;
  }

  const outro: ChatOutro = {
    id: profileRes.data.id,
    nome: profileRes.data.nome_exibicao ?? "Perfil",
    tipo: profileRes.data.tipo,
    verificado: profileRes.data.verificado,
    vip: profileRes.data.vip_ate
      ? new Date(profileRes.data.vip_ate) > new Date()
      : false,
    ultimoAtivo: profileRes.data.ultimo_ativo,
    capa: capaUrl,
    idades: formatIdades(profileRes.data.idade_1, profileRes.data.idade_2),
  };

  // Compatibilidade (só se tivermos os dois perfis carregados)
  const compat =
    meuProfileRes.data && profileRes.data
      ? calcularCompatibilidade(meuProfileRes.data, profileRes.data)
      : null;

  // Inverte pra ordem chronological (oldest→newest) — query é DESC
  // pra pegar as 50 mais RECENTES, mas o Chat client espera array
  // em ordem cronológica (a renderização e scroll-to-bottom dependem).
  const mensagensRaw = (
    (mensagensRes.data ?? []) as MensagemRow[]
  )
    .slice()
    .reverse();

  // Resolve signed URLs pra anexos de imagem (bucket privado).
  // Em batch pra evitar muita ida ao Supabase.
  const anexoPaths = mensagensRaw
    .map((m) => m.anexo_url)
    .filter((p): p is string => !!p);
  const anexoMap = new Map<string, string>();
  if (anexoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("chat-media")
      .createSignedUrls(anexoPaths, 60 * 60); // 1h
    (signed ?? []).forEach((item) => {
      if (item?.path && item.signedUrl) {
        anexoMap.set(item.path, item.signedUrl);
      }
    });
  }

  const mensagens: MensagemRow[] = mensagensRaw.map((m) => ({
    ...m,
    anexoSrc: m.anexo_url ? anexoMap.get(m.anexo_url) ?? null : null,
  }));

  return (
    <Chat
      meId={meId}
      minhaCapa={minhaCapaUrl}
      conversaId={conversa.id}
      matchId={matchId}
      matchedAt={match.created_at as string}
      outro={outro}
      mensagensIniciais={mensagens}
      compatScore={compat?.score ?? null}
    />
  );
}

function formatIdades(a: number | null, b: number | null): string {
  if (a && b) return `${a} · ${b}`;
  if (a) return `${a}`;
  return "";
}
