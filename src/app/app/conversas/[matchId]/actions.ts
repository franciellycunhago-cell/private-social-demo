"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/* ====================================================================
 * Server Actions /app/conversas/[matchId]
 *
 *  - sendMessage(conversaId, texto, anexoPath?, tipoAnexo?):
 *    insere a mensagem e retorna a row inteira (id + created_at +
 *    lido + tipo + ...). O cliente usa esse retorno pra REPLACE o
 *    pending direto, sem depender do echo do Realtime — isso elimina
 *    a race que fazia mensagens "sumirem" depois de enviadas.
 *  - markAsRead(conversaId)   (fire-and-forget, via RPC)
 *
 * Anexo: client faz upload pro bucket chat-media na pasta <user_id>/,
 * depois passa o path aqui. Server cria msg tipo='imagem' ou 'audio'
 * com anexo_url=path. Render gera signed URL na page (refresh) ou
 * client mantém blob local até refresh.
 * ================================================================== */

const MAX_LEN = 1000;

export type SentMessage = {
  id: string;
  conversa_id: string;
  de_id: string;
  texto: string | null;
  tipo: "texto" | "imagem" | "audio";
  anexo_url: string | null;
  lido: boolean;
  created_at: string;
};

export type SendMessageResult =
  | { ok: true; mensagem: SentMessage }
  | { error: string };

export async function sendMessage(
  conversaId: string,
  texto: string,
  anexoPath?: string | null,
  tipoAnexo?: "imagem" | "audio",
): Promise<SendMessageResult> {
  const clean = texto.trim();
  const temAnexo = !!anexoPath && anexoPath.trim().length > 0;

  // Mensagem precisa ter texto OU anexo
  if (!clean && !temAnexo) return { error: "Mensagem vazia." };
  if (clean.length > MAX_LEN)
    return { error: `Máximo ${MAX_LEN} caracteres.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirou." };

  // Valida que o anexo está na pasta do user (path começa com user.id)
  if (temAnexo && !anexoPath!.startsWith(`${user.id}/`)) {
    return { error: "Anexo inválido." };
  }

  const tipoFinal = temAnexo ? (tipoAnexo ?? "imagem") : "texto";

  const { data, error } = await supabase
    .from("mensagens")
    .insert({
      conversa_id: conversaId,
      de_id: user.id,
      texto: clean || null,
      tipo: tipoFinal,
      anexo_url: temAnexo ? anexoPath : null,
    })
    .select("id, conversa_id, de_id, texto, tipo, anexo_url, lido, created_at")
    .single();

  if (error) return { error: error.message };
  if (!data) return { error: "Falha ao salvar mensagem." };

  // Fire-and-forget: descobre o outro participante e notifica
  void (async () => {
    try {
      const { data: conv } = await supabase
        .from("conversas")
        .select("match_id")
        .eq("id", conversaId)
        .single();
      if (!conv) return;
      const { data: match } = await supabase
        .from("matches")
        .select("profile_1, profile_2")
        .eq("id", conv.match_id)
        .single();
      if (!match) return;
      const recipientId =
        match.profile_1 === user.id ? match.profile_2 : match.profile_1;
      await sendPushToUser(
        recipientId,
        {
          title: "Nova mensagem 💬",
          body: temAnexo
            ? tipoAnexo === "audio"
              ? "🎤 Te enviou um áudio."
              : "Te enviou uma foto."
            : "Você tem uma mensagem nova no PrivateSocial.",
          url: `/app/conversas/${conv.match_id}`,
        },
        "mensagens",
      );
    } catch {}
  })();

  return {
    ok: true,
    mensagem: {
      id: data.id as string,
      conversa_id: data.conversa_id as string,
      de_id: data.de_id as string,
      texto: (data.texto as string | null) ?? null,
      tipo: data.tipo as "texto" | "imagem" | "audio",
      anexo_url: (data.anexo_url as string | null) ?? null,
      lido: !!data.lido,
      created_at: data.created_at as string,
    },
  };
}

export async function markAsRead(conversaId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("marcar_mensagens_lidas", {
    p_conversa_id: conversaId,
  });
}
