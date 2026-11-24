import { createClient } from "./supabase/server";
import type { StoryRow } from "./stories-types";

/* ====================================================================
 * Helpers server-side pra stories. Tipos puros em stories-types.ts
 * (pra não puxar `supabase/server` pro bundle client).
 * ================================================================== */

export type { StoryMediaTipo, StoryRow, StoriesBarAutor } from "./stories-types";

export const STORY_SIGNED_TTL_SEC = 60 * 30;

export async function resolveStoriesMedia(
  stories: StoryRow[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (stories.length === 0) return map;

  const supabase = await createClient();
  const { data: signed } = await supabase.storage
    .from("stories")
    .createSignedUrls(
      stories.map((s) => s.media_url),
      STORY_SIGNED_TTL_SEC,
    );

  (signed ?? []).forEach((item) => {
    const story = stories.find((s) => s.media_url === item.path);
    if (story && item.signedUrl) {
      map.set(story.id, item.signedUrl);
    }
  });

  return map;
}

export function isStoryAtivo(s: StoryRow): boolean {
  return new Date(s.expires_at).getTime() > Date.now();
}
