import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Usuários — Admin",
};

/* ====================================================================
 * /admin/usuarios?q=termo
 *
 * Busca admin por nome, @handle, cidade ou email. Click no card
 * abre /admin/usuarios/[id] com mini-perfil + ações.
 * ================================================================== */

type StatusFiltro = "ativos" | "suspensos" | "excluidos" | "todos";

type SearchParams = Promise<{ q?: string; status?: string }>;

type UserRow = {
  id: string;
  nome_exibicao: string | null;
  handle: string | null;
  cidade: string | null;
  estado: string | null;
  tipo: "casal" | "homem" | "mulher" | null;
  verificado: boolean;
  vip_ate: string | null;
  ultimo_ativo: string | null;
  trust_score: number;
  suspenso: boolean;
  deletado_em: string | null;
};

function parseStatus(s: string | undefined): StatusFiltro {
  if (s === "suspensos" || s === "excluidos" || s === "todos") return s;
  return "ativos";
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, status: statusRaw } = await searchParams;
  const termo = (q ?? "").trim();
  const status = parseStatus(statusRaw);

  const admin = adminClient();
  let users: UserRow[] = [];
  let porEmail: UserRow | null = null;
  const buscando = termo.length >= 2;
  const SELECT_COLS =
    "id, nome_exibicao, handle, cidade, estado, tipo, verificado, vip_ate, ultimo_ativo, trust_score, suspenso, deletado_em";

  if (buscando) {
    const pattern = `%${termo}%`;
    const orFilter = `nome_exibicao.ilike.${pattern},handle.ilike.${pattern},cidade.ilike.${pattern}`;

    let q = admin.from("profiles").select(SELECT_COLS).or(orFilter);
    if (status === "ativos") q = q.eq("suspenso", false).is("deletado_em", null);
    else if (status === "suspensos") q = q.eq("suspenso", true).is("deletado_em", null);
    else if (status === "excluidos") q = q.not("deletado_em", "is", null);

    const { data: byProfile } = await q
      .order("ultimo_ativo", { ascending: false, nullsFirst: false })
      .limit(50);

    users = (byProfile ?? []) as UserRow[];

    // Email match ignora filtro de status (busca direta deve sempre achar)
    if (termo.includes("@") && users.length === 0) {
      const { data: authList } = await admin.auth.admin.listUsers({
        perPage: 1000,
      });
      const matchUser = (authList?.users ?? []).find((u) =>
        (u.email ?? "").toLowerCase().includes(termo.toLowerCase()),
      );
      if (matchUser) {
        const { data: prof } = await admin
          .from("profiles")
          .select(SELECT_COLS)
          .eq("id", matchUser.id)
          .maybeSingle<UserRow>();
        if (prof) porEmail = prof;
      }
    }
  } else {
    // Sem termo: lista os 30 mais recentes filtrados por status
    let q = admin.from("profiles").select(SELECT_COLS);
    if (status === "ativos") q = q.eq("suspenso", false).is("deletado_em", null);
    else if (status === "suspensos") q = q.eq("suspenso", true).is("deletado_em", null);
    else if (status === "excluidos") q = q.not("deletado_em", "is", null);

    const { data: recentes } = await q
      .order("ultimo_ativo", { ascending: false, nullsFirst: false })
      .limit(30);
    users = (recentes ?? []) as UserRow[];
  }

  const todosUsers = porEmail ? [porEmail, ...users] : users;

  // Pega a selfie de verificação mais recente de cada user (qualquer
  // status). Pra Franci ver de cara quem mandou e quem está sem foto.
  // Bug 29/04: tinha casais aprovados sem foto — agora aparece um chip
  // vermelho "Sem foto" pra eles na lista.
  const verifByProfile = new Map<
    string,
    { foto_url: string; status: "pendente" | "aprovado" | "rejeitado" }
  >();
  if (todosUsers.length > 0) {
    const ids = todosUsers.map((u) => u.id);
    const { data: verifs } = await admin
      .from("verificacoes")
      .select("profile_id, foto_url, status, created_at")
      .in("profile_id", ids)
      .order("created_at", { ascending: false });
    (verifs ?? []).forEach((v) => {
      const pid = v.profile_id as string;
      if (!verifByProfile.has(pid)) {
        verifByProfile.set(pid, {
          foto_url: v.foto_url as string,
          status: v.status as "pendente" | "aprovado" | "rejeitado",
        });
      }
    });
  }

  const selfieUrls = new Map<string, string | null>();
  const fotoPaths = Array.from(verifByProfile.values()).map((v) => v.foto_url);
  if (fotoPaths.length > 0) {
    const { data: signed } = await admin.storage
      .from("verificacoes")
      .createSignedUrls(fotoPaths, 60 * 30); // 30min
    (signed ?? []).forEach((item) => {
      if (item?.path) selfieUrls.set(item.path, item.signedUrl ?? null);
    });
  }

  // Contagens pros chips (sempre rodam, independente do filtro atual)
  const [cAtivos, cSuspensos, cExcluidos, cTotal] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("suspenso", false)
      .is("deletado_em", null)
      .then((r) => r.count ?? 0),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("suspenso", true)
      .is("deletado_em", null)
      .then((r) => r.count ?? 0),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("deletado_em", "is", null)
      .then((r) => r.count ?? 0),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="display"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Usuários
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 560 }}
        >
          Busca por nome, @handle, cidade ou email. Toque no resultado pra
          abrir o mini-perfil com ações.
        </p>
      </header>

      <form
        method="get"
        action="/admin/usuarios"
        className="flex gap-2 flex-wrap"
      >
        <input
          name="q"
          defaultValue={termo}
          placeholder="Nome, @handle, cidade, email..."
          style={{
            flex: 1,
            minWidth: 240,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "11px 14px",
            color: "var(--text-0)",
            fontSize: 14,
            outline: "none",
          }}
          autoFocus
        />
        {/* Mantém o filtro de status ao buscar */}
        {status !== "ativos" && (
          <input type="hidden" name="status" value={status} />
        )}
        <button
          type="submit"
          className="btn-gold"
          style={{ padding: "10px 22px" }}
        >
          Buscar
        </button>
      </form>

      <div className="flex gap-1.5 flex-wrap">
        <FilterChip
          label="Ativos"
          count={cAtivos}
          active={status === "ativos"}
          href={buildHref(termo, "ativos")}
        />
        <FilterChip
          label="Suspensos"
          count={cSuspensos}
          active={status === "suspensos"}
          tone="warn"
          href={buildHref(termo, "suspensos")}
        />
        <FilterChip
          label="Excluídos"
          count={cExcluidos}
          active={status === "excluidos"}
          tone="muted"
          href={buildHref(termo, "excluidos")}
        />
        <FilterChip
          label="Todos"
          count={cTotal}
          active={status === "todos"}
          href={buildHref(termo, "todos")}
        />
      </div>

      {termo.length > 0 && termo.length < 2 && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
          }}
        >
          Mínimo 2 caracteres pra buscar.
        </div>
      )}

      {termo.length >= 2 && todosUsers.length === 0 && (
        <div
          className="card flex flex-col items-center text-center gap-2"
          style={{ padding: 36 }}
        >
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            Nenhum usuário encontrado
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            Tenta variar o termo (sem @, parte do nome, cidade).
          </div>
        </div>
      )}

      {todosUsers.length > 0 && (
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {buscando
            ? `${todosUsers.length} resultado${todosUsers.length === 1 ? "" : "s"}`
            : `${labelDoFiltro(status)} · ${todosUsers.length}`}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {todosUsers.map((u) => {
          const verif = verifByProfile.get(u.id) ?? null;
          const selfieUrl = verif ? selfieUrls.get(verif.foto_url) ?? null : null;
          return (
            <UserCard
              key={u.id}
              u={u}
              selfieUrl={selfieUrl}
              verifStatus={verif?.status ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

function UserCard({
  u,
  selfieUrl,
  verifStatus,
}: {
  u: UserRow;
  selfieUrl: string | null;
  verifStatus: "pendente" | "aprovado" | "rejeitado" | null;
}) {
  const isDeletado = !!u.deletado_em;
  const isSuspenso = u.suspenso;
  const cidade = [u.cidade, u.estado].filter(Boolean).join(", ");
  const tipoLabel =
    u.tipo === "casal" ? "Casal" : u.tipo === "mulher" ? "Mulher" : u.tipo === "homem" ? "Homem" : null;

  // Cor da borda da miniatura conforme status da verificação:
  // - aprovado: dourado (já passou pela moderação)
  // - pendente: amarelo/atenção
  // - rejeitado: vermelho
  // - sem foto: cinza
  const selfieBorder = !selfieUrl
    ? "2px dashed rgba(217,138,114,0.6)"
    : verifStatus === "aprovado"
      ? "2px solid var(--gold-500)"
      : verifStatus === "pendente"
        ? "2px solid #d4a04a"
        : verifStatus === "rejeitado"
          ? "2px solid var(--rose-500)"
          : "2px solid var(--line)";

  return (
    <Link
      href={`/admin/usuarios/${u.id}`}
      className="card flex items-center gap-3"
      style={{
        padding: 14,
        textDecoration: "none",
        opacity: isDeletado ? 0.55 : 1,
        borderColor: isSuspenso
          ? "rgba(217,138,114,0.5)"
          : isDeletado
            ? "var(--line)"
            : undefined,
      }}
    >
      {/* Miniatura da selfie de verificação (52×52). Quem não mandou
       *  aparece com placeholder dashed vermelho "Sem foto" — Franci
       *  vê de cara quem cadastrou sem mandar selfie (bug 29/04). */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: selfieBorder,
          background: "var(--bg-2)",
        }}
      >
        {selfieUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={selfieUrl}
            alt={`Selfie de ${u.nome_exibicao ?? "usuário"}`}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              color: "var(--rose-400)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              textAlign: "center",
              lineHeight: 1.1,
              padding: 2,
            }}
          >
            SEM<br />FOTO
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="display"
            style={{ fontSize: 16, fontWeight: 600, color: "var(--text-0)" }}
          >
            {u.nome_exibicao ?? "Sem nome"}
          </span>
          {u.handle && (
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
              @{u.handle}
            </span>
          )}
          {u.verificado && (
            <span
              className="chip"
              style={{
                fontSize: 9,
                color: "var(--gold-300)",
                borderColor: "var(--gold-600)",
              }}
            >
              ✓
            </span>
          )}
          {isSuspenso && (
            <span
              className="chip"
              style={{
                fontSize: 9,
                color: "var(--rose-400)",
                borderColor: "rgba(217,138,114,0.5)",
                background: "rgba(217,138,114,0.08)",
              }}
            >
              SUSPENSO
            </span>
          )}
          {isDeletado && (
            <span
              className="chip"
              style={{
                fontSize: 9,
                color: "var(--text-3)",
                borderColor: "var(--line-strong)",
              }}
            >
              EXCLUÍDO
            </span>
          )}
        </div>
        <div
          style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}
        >
          {[cidade, tipoLabel, `Trust ${u.trust_score}%`]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <span style={{ color: "var(--text-3)", fontSize: 18 }}>›</span>
    </Link>
  );
}

function buildHref(termo: string, status: StatusFiltro): string {
  const params = new URLSearchParams();
  if (termo) params.set("q", termo);
  if (status !== "ativos") params.set("status", status);
  const qs = params.toString();
  return qs ? `/admin/usuarios?${qs}` : "/admin/usuarios";
}

function labelDoFiltro(s: StatusFiltro): string {
  if (s === "ativos") return "Ativos · últimos";
  if (s === "suspensos") return "Suspensos";
  if (s === "excluidos") return "Excluídos";
  return "Todos · últimos";
}

function FilterChip({
  label,
  count,
  active,
  href,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  tone?: "warn" | "muted";
}) {
  const cor =
    tone === "warn"
      ? { fg: "var(--rose-400)", border: "rgba(217,138,114,0.5)" }
      : tone === "muted"
        ? { fg: "var(--text-3)", border: "var(--line-strong)" }
        : { fg: "var(--gold-300)", border: "var(--gold-600)" };
  return (
    <Link
      href={href}
      className="mono"
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? cor.border : "var(--line)"}`,
        background: active
          ? tone === "warn"
            ? "rgba(217,138,114,0.1)"
            : tone === "muted"
              ? "rgba(255,255,255,0.04)"
              : "rgba(212,175,110,0.12)"
          : "transparent",
        color: active ? cor.fg : "var(--text-2)",
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontWeight: active ? 700 : 500,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 10,
          padding: "1px 6px",
          borderRadius: 999,
          background: active ? "rgba(0,0,0,0.25)" : "var(--bg-2)",
          color: active ? cor.fg : "var(--text-3)",
        }}
      >
        {count}
      </span>
    </Link>
  );
}
