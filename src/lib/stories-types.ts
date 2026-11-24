// Tipos puros de stories — importável por server e client sem trazer
// `supabase/server` pro bundle client.

export type StoryMediaTipo = "imagem" | "video";

export type StoryRow = {
  id: string;
  profile_id: string;
  media_url: string;
  media_tipo: StoryMediaTipo;
  duracao_ms: number | null;
  texto: string | null;
  created_at: string;
  expires_at: string;
  evento_id?: string | null;
};

export type StoryEventoTag = {
  id: string;
  titulo: string;
} | null;

export type StoriesBarAutor = {
  profileId: string;
  nome: string;
  capa: string | null;
  temNaoVisto: boolean;
  checkin?: { id: string; titulo: string } | null;
  stories: {
    id: string;
    mediaUrl: string;
    mediaTipo: StoryMediaTipo;
    duracaoMs: number | null;
    texto: string | null;
    createdAt: string;
    liked: boolean;
    evento: StoryEventoTag;
  }[];
};
