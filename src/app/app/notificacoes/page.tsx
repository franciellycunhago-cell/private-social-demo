import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import { NotificacoesList, type NotificacaoItem } from "./list";
import type { NotificacaoTipo } from "@/lib/notificacoes";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Notificações — PrivateSocial",
};

const PAGE_SIZE = 50;

/* ====================================================================
 * /app/notificacoes
 *
 * Tela estilo Instagram/D4 que mostra histórico cronológico de quem
 * interagiu com o user — curtiu post, comentou, deu match, etc.
 *
 *  - Server fetcha últimas 50 notificações + marca todas como lidas
 *    no MESMO render (otimização: zera badge na hora que abre)
 *  - Lista é client component pra suportar deep links sem refresh
 *  - Cada item tem ícone, avatar do actor, mensagem e tempo relativo
 *  - Click na notif → vai pro destino certo (definido por
 *    notificacaoDestino em lib/notificacoes.ts)
 * ================================================================== */

export default async function NotificacoesPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const admin = adminClient();
  const supabase = await createClient();

  // Carrega últimas notificações
  const { data: notifsRaw } = await admin
    .from("notificacoes")
    .select(
      "id, tipo, actor_id, post_id, comment_id, match_id, foto_id, metadata, lida, created_at",
    )
    .eq("user_id", meId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  type NotifRow = {
    id: string;
    tipo: NotificacaoTipo;
    actor_id: string | null;
    post_id: string | null;
    comment_id: string | null;
    match_id: string | null;
    foto_id: string | null;
    metadata: Record<string, unknown> | null;
    lida: boolean;
    created_at: string;
  };

  const notifs = (notifsRaw ?? []) as NotifRow[];

  // Resolve atores em batch
  const actorIds = Array.from(
    new Set(notifs.map((n) => n.actor_id).filter((id): id is string => !!id)),
  );

  type ActorLite = {
    id: string;
    nome_exibicao: string | null;
    handle: string | null;
  };

  const actorsMap = new Map<string, ActorLite & { capa: string | null }>();

  if (actorIds.length > 0) {
    const [profilesRes, capasRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, nome_exibicao, handle")
        .in("id", actorIds),
      admin
        .from("fotos")
        .select("profile_id, url, ordem")
        .in("profile_id", actorIds)
        .eq("tipo", "publica")
        .order("ordem", { ascending: true }),
    ]);

    const capaMap = new Map<string, string>();
    (capasRes.data ?? []).forEach((f) => {
      const pid = f.profile_id as string;
      if (!capaMap.has(pid)) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url as string);
        capaMap.set(pid, data.publicUrl);
      }
    });

    ((profilesRes.data ?? []) as ActorLite[]).forEach((p) =>
      actorsMap.set(p.id, { ...p, capa: capaMap.get(p.id) ?? null }),
    );
  }

  const items: NotificacaoItem[] = notifs.map((n) => {
    const actor = n.actor_id ? actorsMap.get(n.actor_id) : null;
    return {
      id: n.id,
      tipo: n.tipo,
      lida: n.lida,
      createdAt: n.created_at,
      postId: n.post_id,
      commentId: n.comment_id,
      matchId: n.match_id,
      fotoId: n.foto_id,
      metadata: n.metadata ?? {},
      actor: actor
        ? {
            id: actor.id,
            nome: actor.nome_exibicao ?? "Alguém",
            handle: actor.handle,
            capa: actor.capa,
          }
        : null,
    };
  });

  // Marca todas as não-lidas como lidas. AWAIT (não fire-and-forget) pra
  // garantir que o update commita antes do render — em Server Components
  // do Next.js, void promises podem ser canceladas no fim da response.
  // Sem isso, o badge no bottom nav não zerava (bug 28/04 noite).
  const naoLidas = notifs.filter((n) => !n.lida).map((n) => n.id);
  if (naoLidas.length > 0) {
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .in("id", naoLidas);
  }

  return (
    <div
      className="relative flex flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header
        className="relative z-10 flex items-center justify-center px-5"
        style={{
          paddingTop: 24,
          paddingBottom: 14,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          className="display"
          style={{
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--text-0)",
          }}
        >
          Notificações
        </div>
      </header>

      <div className="relative z-10 flex-1 pb-8">
        <NotificacoesList items={items} />
      </div>
    </div>
  );
}
