import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getProfileStatus } from "@/lib/supabase/profile";
import { PedidosPendentes, type PedidoPendente } from "./pedidos-pendentes";
import { PageHeading } from "@/components/page-heading";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Conversas — PrivateSocial",
};

/* ====================================================================
 * /app/conversas
 *
 *  - Carrossel "Novos matches" (últimos 7 dias)
 *  - Pedidos de acesso privado pendentes (aprovar/negar inline)
 *  - Lista "Seus matches" com última mensagem + unread
 *  - Clicar abre /app/conversas/[matchId]
 * ================================================================== */

type MatchRow = {
  id: string;
  profile_1: string;
  profile_2: string;
  created_at: string;
};

type OtherProfile = {
  id: string;
  nome_exibicao: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  cidade: string | null;
  estado: string | null;
  idade_1: number | null;
  idade_2: number | null;
  verificado: boolean;
  vip_ate: string | null;
};

type ConversaInfo = {
  matchId: string;
  conversaId: string | null;
  ultimaMsg: {
    texto: string | null;
    tipo: "texto" | "imagem" | "audio";
    deMim: boolean;
    createdAt: string;
  } | null;
  naoLidas: number;
};

type MatchItem = {
  matchId: string;
  matchedAt: string;
  outro: OtherProfile;
  capa: string | null;
  conversa: ConversaInfo;
};

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default async function ConversasPage() {
  const info = await getProfileStatus();
  if (!info || info.status.state !== "aprovado") redirect("/login");
  const me = info.userId;

  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, profile_1, profile_2, created_at")
    .or(`profile_1.eq.${me},profile_2.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (matches ?? []) as MatchRow[];

  // Pedidos de acesso privado pendentes (onde eu sou o alvo)
  const pedidos = await loadPedidosPendentes(me);

  if (rows.length === 0 && pedidos.length === 0) {
    return <EmptyConversas />;
  }

  const otherIds = rows.map((m) => (m.profile_1 === me ? m.profile_2 : m.profile_1));
  const matchIds = rows.map((m) => m.id);

  const [profilesRes, fotosRes, conversasRes, mensagensRes] = await Promise.all([
    otherIds.length > 0
      ? supabase
          .from("profiles")
          .select(
            "id, nome_exibicao, tipo, cidade, estado, idade_1, idade_2, verificado, vip_ate",
          )
          .in("id", otherIds)
      : Promise.resolve({ data: [] as OtherProfile[] }),
    otherIds.length > 0
      ? supabase
          .from("fotos")
          .select("profile_id, url")
          .in("profile_id", otherIds)
          .eq("tipo", "publica")
          .order("ordem", { ascending: true })
      : Promise.resolve({ data: [] as { profile_id: string; url: string }[] }),
    matchIds.length > 0
      ? supabase
          .from("conversas")
          .select("id, match_id, ultima_mensagem_em")
          .in("match_id", matchIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            match_id: string;
            ultima_mensagem_em: string | null;
          }[],
        }),
    // Puxa a última mensagem de cada conversa (1 query com ordem desc + limit por conversa
    // não é trivial — aqui pegamos as últimas 200 mensagens de todas as minhas conversas
    // e agrupamos no JS. Para MVP com < 100 matches isso é o mais barato).
    matchIds.length > 0
      ? supabase
          .from("mensagens")
          .select("id, conversa_id, de_id, texto, tipo, lido, created_at")
          .order("created_at", { ascending: false })
          .limit(400)
      : Promise.resolve({
          data: [] as {
            id: string;
            conversa_id: string;
            de_id: string;
            texto: string | null;
            tipo: "texto" | "imagem" | "audio";
            lido: boolean;
            created_at: string;
          }[],
        }),
  ]);

  const profileMap = new Map<string, OtherProfile>();
  ((profilesRes.data ?? []) as OtherProfile[]).forEach((p) =>
    profileMap.set(p.id, p),
  );

  const fotoMap = new Map<string, string>();
  ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
    (f) => {
      if (!fotoMap.has(f.profile_id)) {
        const { data } = supabase.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url);
        fotoMap.set(f.profile_id, data.publicUrl);
      }
    },
  );

  const conversaByMatch = new Map<
    string,
    { id: string; ultima: string | null }
  >();
  ((conversasRes.data ?? []) as {
    id: string;
    match_id: string;
    ultima_mensagem_em: string | null;
  }[]).forEach((c) =>
    conversaByMatch.set(c.match_id, { id: c.id, ultima: c.ultima_mensagem_em }),
  );

  // Agrupa mensagens por conversa
  const conversaIdToMatchId = new Map<string, string>();
  conversaByMatch.forEach((v, matchId) =>
    conversaIdToMatchId.set(v.id, matchId),
  );

  const ultimaMsgPorConversa = new Map<
    string,
    {
      texto: string | null;
      tipo: "texto" | "imagem" | "audio";
      deMim: boolean;
      createdAt: string;
    }
  >();
  const naoLidasPorConversa = new Map<string, number>();

  ((mensagensRes.data ?? []) as {
    conversa_id: string;
    de_id: string;
    texto: string | null;
    tipo: "texto" | "imagem" | "audio";
    lido: boolean;
    created_at: string;
  }[]).forEach((m) => {
    if (!ultimaMsgPorConversa.has(m.conversa_id)) {
      ultimaMsgPorConversa.set(m.conversa_id, {
        texto: m.texto,
        tipo: m.tipo,
        deMim: m.de_id === me,
        createdAt: m.created_at,
      });
    }
    if (m.de_id !== me && !m.lido) {
      naoLidasPorConversa.set(
        m.conversa_id,
        (naoLidasPorConversa.get(m.conversa_id) ?? 0) + 1,
      );
    }
  });

  const items: MatchItem[] = rows
    .map((m) => {
      const otherId = m.profile_1 === me ? m.profile_2 : m.profile_1;
      const outro = profileMap.get(otherId);
      if (!outro) return null;
      const conv = conversaByMatch.get(m.id) ?? null;
      const convId = conv?.id ?? null;
      const ultimaMsg =
        (convId && ultimaMsgPorConversa.get(convId)) || null;
      const naoLidas = convId ? (naoLidasPorConversa.get(convId) ?? 0) : 0;
      return {
        matchId: m.id,
        matchedAt: m.created_at,
        outro,
        capa: fotoMap.get(otherId) ?? null,
        conversa: {
          matchId: m.id,
          conversaId: convId,
          ultimaMsg,
          naoLidas,
        },
      };
    })
    .filter((x): x is MatchItem => x !== null);

  // Ordena por última atividade (última mensagem ou match_created_at)
  items.sort((a, b) => {
    const aT = new Date(
      a.conversa.ultimaMsg?.createdAt ?? a.matchedAt,
    ).getTime();
    const bT = new Date(
      b.conversa.ultimaMsg?.createdAt ?? b.matchedAt,
    ).getTime();
    return bT - aT;
  });

  const now = Date.now();
  const novos = items.filter(
    (i) =>
      !i.conversa.ultimaMsg &&
      now - new Date(i.matchedAt).getTime() < SEVEN_DAYS,
  );

  return (
    <div className="flex flex-col px-5 pt-10">
      <PageHeading
        title="Conversas"
        subtitle={[
          items.length === 1 ? "1 match ativo" : `${items.length} matches ativos`,
          novos.length > 0
            ? `${novos.length} novo${novos.length > 1 ? "s" : ""} essa semana`
            : null,
          pedidos.length > 0
            ? `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""} de acesso`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <PedidosPendentes iniciais={pedidos} />

      {novos.length > 0 && (
        <section className="pt-6">
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 12,
            }}
          >
            Novos matches
          </div>
          <div className="flex gap-3 overflow-x-auto scroll pb-1">
            {novos.map((item) => (
              <NewMatchAvatar key={item.matchId} item={item} />
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="pt-6">
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--text-2)",
              marginBottom: 8,
            }}
          >
            Todos os matches
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
            }}
          >
            {items.map((item, i) => (
              <MatchRowItem
                key={item.matchId}
                item={item}
                last={i === items.length - 1}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


async function loadPedidosPendentes(
  me: string,
): Promise<PedidoPendente[]> {
  const supabase = adminClient();
  const { data: raw } = await supabase
    .from("pedidos_privado")
    .select("id, solicitante_id, status, created_at")
    .eq("alvo_id", me)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(30);

  const pedidos = raw ?? [];
  if (pedidos.length === 0) return [];

  const solicitanteIds = pedidos.map(
    (p) => p.solicitante_id as string,
  );

  const [profilesRes, fotosRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome_exibicao, tipo, cidade, estado")
      .in("id", solicitanteIds),
    supabase
      .from("fotos")
      .select("profile_id, url")
      .in("profile_id", solicitanteIds)
      .eq("tipo", "publica")
      .order("ordem", { ascending: true }),
  ]);

  const profileMap = new Map<
    string,
    {
      id: string;
      nome_exibicao: string | null;
      tipo: "casal" | "homem" | "mulher" | null;
      cidade: string | null;
      estado: string | null;
    }
  >();
  ((profilesRes.data ?? []) as {
    id: string;
    nome_exibicao: string | null;
    tipo: "casal" | "homem" | "mulher" | null;
    cidade: string | null;
    estado: string | null;
  }[]).forEach((p) => profileMap.set(p.id, p));

  const fotoMap = new Map<string, string>();
  ((fotosRes.data ?? []) as { profile_id: string; url: string }[]).forEach(
    (f) => {
      if (!fotoMap.has(f.profile_id)) {
        const { data } = supabase.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url);
        fotoMap.set(f.profile_id, data.publicUrl);
      }
    },
  );

  return pedidos
    .map((p) => {
      const sid = p.solicitante_id as string;
      const prof = profileMap.get(sid);
      if (!prof) return null;
      const cidade = [prof.cidade, prof.estado].filter(Boolean).join(", ");
      return {
        id: p.id as string,
        solicitanteId: sid,
        nome: prof.nome_exibicao ?? "Perfil",
        capa: fotoMap.get(sid) ?? null,
        cidade: cidade || null,
        tipo: prof.tipo,
        createdAt: p.created_at as string,
      };
    })
    .filter((x): x is PedidoPendente => x !== null);
}

function NewMatchAvatar({ item }: { item: MatchItem }) {
  const nome = item.outro.nome_exibicao ?? "Perfil";
  return (
    <Link
      href={`/app/conversas/${item.matchId}`}
      className="flex-shrink-0 text-center"
      style={{ width: 72, textDecoration: "none" }}
    >
      <div
        className="relative mx-auto"
        style={{
          width: 68,
          height: 68,
          padding: 2,
          borderRadius: "50%",
          background: "conic-gradient(var(--gold-300), var(--gold-600), var(--gold-300))",
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "3px solid var(--bg-0)",
            background: "var(--bg-2)",
          }}
        >
          {item.capa ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.capa}
              alt={nome}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "var(--gold-300)", fontSize: 22 }}
            >
              ♥
            </div>
          )}
        </div>
      </div>
      <div
        className="mt-2 truncate"
        style={{ fontSize: 11, color: "var(--text-1)" }}
      >
        {firstName(nome)}
      </div>
    </Link>
  );
}

function MatchRowItem({ item, last }: { item: MatchItem; last: boolean }) {
  const nome = item.outro.nome_exibicao ?? "Perfil";
  const cidade = [item.outro.cidade, item.outro.estado].filter(Boolean).join(", ");
  const isVip = item.outro.vip_ate
    ? new Date(item.outro.vip_ate) > new Date()
    : false;
  const unread = item.conversa.naoLidas;

  const preview =
    item.conversa.ultimaMsg
      ? previewText(item.conversa.ultimaMsg)
      : { text: `Match ${relativeTime(item.matchedAt)}`, dim: true };

  const timeLabel = item.conversa.ultimaMsg
    ? relativeTimeShort(item.conversa.ultimaMsg.createdAt)
    : "";

  return (
    <Link
      href={`/app/conversas/${item.matchId}`}
      className="flex items-center gap-3 px-4 py-3"
      style={{
        borderBottom: last ? "none" : "1px solid var(--line)",
        textDecoration: "none",
      }}
    >
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
        }}
      >
        {item.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.capa}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--gold-300)", fontSize: 18 }}
          >
            ♥
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div
            className="truncate"
            style={{
              fontSize: 14,
              fontWeight: unread > 0 ? 700 : 600,
              color: "var(--text-0)",
            }}
          >
            {nome}
          </div>
          {isVip && (
            <span
              style={{
                background: "var(--shine-gold)",
                color: "#1a0f05",
                fontSize: 8,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}
            >
              VIP
            </span>
          )}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 12,
            color: preview.dim ? "var(--text-3)" : "var(--text-1)",
            marginTop: 1,
            fontWeight: unread > 0 ? 600 : 400,
          }}
        >
          {preview.text}
          {cidade && !item.conversa.ultimaMsg ? ` · ${cidade}` : ""}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {timeLabel && (
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
            {timeLabel}
          </span>
        )}
        {unread > 0 ? (
          <span
            className="flex items-center justify-center"
            style={{
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 999,
              background: "var(--shine-gold)",
              color: "#1a0f05",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : (
          <span style={{ color: "var(--text-3)", fontSize: 18 }}>›</span>
        )}
      </div>
    </Link>
  );
}

function previewText(msg: {
  texto: string | null;
  tipo: "texto" | "imagem" | "audio";
  deMim: boolean;
}): { text: string; dim: boolean } {
  const prefix = msg.deMim ? "Você: " : "";
  if (msg.tipo === "imagem") return { text: `${prefix}📷 Foto`, dim: false };
  if (msg.tipo === "audio") return { text: `${prefix}🎤 Áudio`, dim: false };
  return { text: `${prefix}${msg.texto ?? ""}`, dim: false };
}

function EmptyConversas() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 pt-24 gap-3">
      <div
        className="display gold-text"
        style={{ fontSize: 30, fontWeight: 500 }}
      >
        Ainda sem matches
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-2)",
          lineHeight: 1.5,
          maxWidth: 300,
        }}
      >
        Quando alguém curtir você de volta, aparece aqui. Volta no Descobrir e
        continua curtindo.
      </div>
      <Link
        href="/app/descobrir"
        className="btn-gold mt-3"
        style={{ padding: "11px 22px", textDecoration: "none" }}
      >
        Ir para Descobrir
      </Link>
    </div>
  );
}

function firstName(nome: string): string {
  return nome.split(/[\s&]/)[0] ?? nome;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks}sem`;
  const months = Math.floor(days / 30);
  return `há ${months}m`;
}

function relativeTimeShort(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return "+7d";
}
