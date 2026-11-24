import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileStatus } from "@/lib/supabase/profile";
import { resolveStoriesMedia, type StoryRow } from "@/lib/stories";
import { formatEventoData } from "@/lib/eventos";
import { PageHeading } from "@/components/page-heading";
import { StoryUploader, type EventoOpcao } from "./uploader";
import { StoryCard } from "./story-card";

export const metadata = {
  title: "Meus stories — PrivateSocial",
};

/* ====================================================================
 * /app/perfil/stories
 *
 *  - Uploader no topo (foto + caption opcional)
 *  - Grid com stories ativos (menos de 24h)
 *  - Cada card mostra countdown + quem viu + botão apagar
 *  - Stories expirados ficam ocultos (RLS no select impõe, mas também
 *    filtramos aqui por garantia)
 * ================================================================== */

type StoryComViews = StoryRow & {
  views: number;
  likes: number;
  mediaUrl: string | null;
};

export default async function StoriesPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const meId = info.userId;

  const supabase = await createClient();

  const [{ data: storiesRaw }, { data: eventosRaw }] = await Promise.all([
    supabase
      .from("stories")
      .select(
        "id, profile_id, media_url, media_tipo, duracao_ms, texto, created_at, expires_at, evento_id",
      )
      .eq("profile_id", meId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("eventos")
      .select("id, titulo, data")
      .eq("publicado", true)
      .gte("data", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .lte("data", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("data", { ascending: true })
      .limit(20),
  ]);

  const eventosOpts: EventoOpcao[] = (eventosRaw ?? []).map((e) => ({
    id: e.id as string,
    titulo: e.titulo as string,
    dataFmt: formatEventoData(e.data as string),
  }));

  const stories = (storiesRaw ?? []) as StoryRow[];
  const mediaMap = await resolveStoriesMedia(stories);

  // Resolve nome dos eventos marcados (inclui eventos passados/fora do
  // range dos chips do uploader)
  const eventosByStory = new Map<string, { id: string; titulo: string }>();
  (eventosRaw ?? []).forEach((e) =>
    eventosByStory.set(e.id as string, {
      id: e.id as string,
      titulo: e.titulo as string,
    }),
  );
  const missingEventIds = Array.from(
    new Set(
      stories
        .map((s) => s.evento_id ?? null)
        .filter((id): id is string => !!id && !eventosByStory.has(id)),
    ),
  );
  if (missingEventIds.length > 0) {
    const { data: extra } = await supabase
      .from("eventos")
      .select("id, titulo")
      .in("id", missingEventIds);
    (extra ?? []).forEach((e) =>
      eventosByStory.set(e.id as string, {
        id: e.id as string,
        titulo: e.titulo as string,
      }),
    );
  }

  // Contagem de views + likes por story
  const viewsMap = new Map<string, number>();
  const likesMap = new Map<string, number>();
  if (stories.length > 0) {
    const { data: views } = await supabase
      .from("stories_views")
      .select("story_id, liked")
      .in(
        "story_id",
        stories.map((s) => s.id),
      );
    (views ?? []).forEach((v) => {
      const sid = v.story_id as string;
      viewsMap.set(sid, (viewsMap.get(sid) ?? 0) + 1);
      if (v.liked) likesMap.set(sid, (likesMap.get(sid) ?? 0) + 1);
    });
  }

  const itens: StoryComViews[] = stories.map((s) => ({
    ...s,
    views: viewsMap.get(s.id) ?? 0,
    likes: likesMap.get(s.id) ?? 0,
    mediaUrl: mediaMap.get(s.id) ?? null,
  }));

  return (
    <div className="flex flex-col px-5 pt-10 pb-6">
      <Link
        href="/app/perfil"
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-3)",
          textDecoration: "none",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        ‹ Perfil
      </Link>

      <PageHeading title="Meus stories" subtitle="Somem em 24h · só matches veem" />

      <div className="pt-5">
        <StoryUploader eventos={eventosOpts} />
      </div>

      {itens.length === 0 ? (
        <div className="pt-10 text-center">
          <div
            className="display"
            style={{ fontSize: 18, color: "var(--text-1)" }}
          >
            Nenhum story ativo
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              marginTop: 4,
              maxWidth: 300,
              margin: "4px auto 0",
              lineHeight: 1.5,
            }}
          >
            Posta uma foto rápida e ela aparece pros seus matches pelas
            próximas 24h.
          </div>
        </div>
      ) : (
        <section className="pt-6">
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 10,
            }}
          >
            Ativos
          </div>
          <div className="grid grid-cols-2 gap-3">
            {itens.map((s) => (
              <StoryCard
                key={s.id}
                mediaTipo={s.media_tipo}
                likes={s.likes}
                storyId={s.id}
                mediaUrl={s.mediaUrl}
                texto={s.texto}
                createdAt={s.created_at}
                expiresAt={s.expires_at}
                views={s.views}
                evento={
                  s.evento_id
                    ? eventosByStory.get(s.evento_id) ?? null
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
