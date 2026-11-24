import { createClient } from "@/lib/supabase/server";
import { EVENTO_COLS, type EventoRow } from "@/lib/eventos";
import { EventosGrid, type EventoCardData } from "./eventos-grid";

export const metadata = {
  title: "Eventos — Admin PrivateSocial",
};

/* ====================================================================
 * /admin/eventos
 *
 *  - Lista TODOS os eventos (draft + publicado + passados)
 *  - Conta confirmações por evento (select count)
 *  - Resolve URLs das capas (bucket eventos)
 *  - Renderiza EventosGrid (client) que cuida do modal de criar/editar
 * ================================================================== */

export default async function AdminEventosPage() {
  const supabase = await createClient();

  // RLS eventos_admin_all permite o admin ler tudo (incluindo rascunhos
  // não publicados). Ordem: rascunhos no topo, depois futuros crescente,
  // passados descrescente no rodapé — feito no JS pra simplicidade.
  const { data: eventosRaw } = await supabase
    .from("eventos")
    .select(EVENTO_COLS)
    .order("data", { ascending: true })
    .limit(200);

  const eventos = (eventosRaw ?? []) as EventoRow[];

  // Contagem de confirmações
  let confirmacoesMap = new Map<string, number>();
  if (eventos.length > 0) {
    const { data: confs } = await supabase
      .from("confirmacoes_evento")
      .select("evento_id")
      .in(
        "evento_id",
        eventos.map((e) => e.id),
      );
    (confs ?? []).forEach((c) => {
      const id = c.evento_id as string;
      confirmacoesMap.set(id, (confirmacoesMap.get(id) ?? 0) + 1);
    });
  }

  // Resolver capas
  const fotoMap = new Map<string, string>();
  for (const e of eventos) {
    if (!e.foto_url) continue;
    if (e.foto_url.startsWith("http")) {
      fotoMap.set(e.id, e.foto_url);
    } else {
      const { data } = supabase.storage
        .from("eventos")
        .getPublicUrl(e.foto_url);
      fotoMap.set(e.id, data.publicUrl);
    }
  }

  // Ordenação final: rascunhos primeiro, futuros cronológico, passados inverso
  const now = Date.now();
  const rascunhos: EventoRow[] = [];
  const futuros: EventoRow[] = [];
  const passados: EventoRow[] = [];
  for (const e of eventos) {
    const isPast = new Date(e.data).getTime() < now;
    if (!e.publicado) rascunhos.push(e);
    else if (isPast) passados.push(e);
    else futuros.push(e);
  }
  passados.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const ordered = [...rascunhos, ...futuros, ...passados];

  const cards: EventoCardData[] = ordered.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    descricao: e.descricao,
    data: e.data,
    local: e.local,
    cidade: e.cidade,
    capacidade: e.capacidade,
    dress_code: e.dress_code,
    tipo: e.tipo,
    patrocinador_nome: e.patrocinador_nome,
    valor_patrocinio: e.valor_patrocinio,
    foto_url: e.foto_url,
    foto_preview: fotoMap.get(e.id) ?? null,
    vip_only: e.vip_only,
    publicado: e.publicado,
    destacado: e.destacado,
    confirmacoes: confirmacoesMap.get(e.id) ?? 0,
  }));

  const totalAtivos = eventos.filter(
    (e) => e.publicado && new Date(e.data).getTime() >= now,
  ).length;
  const totalRascunhos = rascunhos.length;

  return (
    <EventosGrid
      eventos={cards}
      totalAtivos={totalAtivos}
      totalRascunhos={totalRascunhos}
    />
  );
}
