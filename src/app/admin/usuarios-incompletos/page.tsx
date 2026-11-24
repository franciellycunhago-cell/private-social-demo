import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { computeFotoGrace, MIN_FOTOS, GRACE_DAYS } from "@/lib/foto-grace";
import { countUserContentFotosBatch } from "@/lib/foto-grace-server";
import { LembreteButton } from "./lembrete-button";
import { LembreteEmLoteButton } from "./lembrete-em-lote-button";

export const metadata = {
  title: "Fotos incompletas — Admin",
};

/* ====================================================================
 * /admin/usuarios-incompletos
 *
 * Lista todos os usuários verificados e ativos que ainda não postaram
 * o mínimo de fotos públicas. Ordenado por urgência (menos dias
 * restantes primeiro). Cada linha tem botão "Enviar lembrete" que
 * dispara notificação in-app + push.
 * ================================================================== */

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type ProfileLite = {
  id: string;
  nome_exibicao: string | null;
  handle: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  ultimo_ativo: string | null;
  verificado_em: string | null;
  created_at: string | null;
};

type FotoCount = {
  profile_id: string;
  count: number;
};

export default async function UsuariosIncompletosPage() {
  const admin = adminClient();

  // 1. Pega todos os perfis verificados, não suspensos, não deletados
  const { data: profilesRaw } = await admin
    .from("profiles")
    .select(
      "id, nome_exibicao, handle, cidade, estado, telefone, ultimo_ativo, verificado_em, created_at",
    )
    .eq("verificado", true)
    .eq("suspenso", false)
    .is("deletado_em", null);

  const profiles = (profilesRaw ?? []) as ProfileLite[];

  if (profiles.length === 0) {
    return <EmptyState />;
  }

  // 2. Conta conteúdo com foto (fotos perfil + publicações com foto) em batch
  const profileIds = profiles.map((p) => p.id);
  const { total: totalMap, fotosPerfil, postsComFoto } =
    await countUserContentFotosBatch(admin, profileIds);

  // 3. Calcula grace status, filtra só quem está incompleto, ordena por urgência
  type LinhaUsuario = ProfileLite & {
    fotosCount: number;
    fotosPerfilCount: number;
    postsComFotoCount: number;
    diasRestantes: number;
    bloqueado: boolean;
    capa: string | null;
  };

  const incompletos: LinhaUsuario[] = profiles
    .map((p) => {
      const grace = computeFotoGrace(
        totalMap.get(p.id) ?? 0,
        p.verificado_em,
        p.created_at,
      );
      return {
        ...p,
        ...grace,
        fotosPerfilCount: fotosPerfil.get(p.id) ?? 0,
        postsComFotoCount: postsComFoto.get(p.id) ?? 0,
        capa: null as string | null,
      };
    })
    .filter((p) => p.fotosFaltam > 0)
    .sort((a, b) => {
      // Bloqueados primeiro, depois por dias restantes asc, depois alfabético
      if (a.bloqueado !== b.bloqueado) return a.bloqueado ? -1 : 1;
      if (a.diasRestantes !== b.diasRestantes)
        return a.diasRestantes - b.diasRestantes;
      return (a.nome_exibicao ?? "").localeCompare(b.nome_exibicao ?? "");
    });

  // 4. Pega capas (1 foto por perfil — quem tem 1 ou 2 fotos)
  const idsComFoto = incompletos.filter((p) => p.fotosCount > 0).map((p) => p.id);
  if (idsComFoto.length > 0) {
    const { data: capas } = await admin
      .from("fotos")
      .select("profile_id, url, ordem")
      .in("profile_id", idsComFoto)
      .eq("tipo", "publica")
      .is("deletado_em", null)
      .order("ordem", { ascending: true });

    const capaMap = new Map<string, string>();
    ((capas ?? []) as { profile_id: string; url: string }[]).forEach((f) => {
      if (!capaMap.has(f.profile_id)) {
        const { data } = admin.storage
          .from("fotos-publicas")
          .getPublicUrl(f.url);
        capaMap.set(f.profile_id, data.publicUrl);
      }
    });
    incompletos.forEach((p) => {
      p.capa = capaMap.get(p.id) ?? null;
    });
  }

  const totalBloqueados = incompletos.filter((p) => p.bloqueado).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1
          className="display"
          style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          Fotos incompletas
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            marginTop: 4,
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          Membros ativos que ainda não atingiram {MIN_FOTOS} conteúdos com
          foto (fotos do perfil + publicações com foto contam). Têm{" "}
          {GRACE_DAYS} dias após aprovação. Use o botão pra mandar lembrete
          (notif in-app + push).
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Stat
          label="Total incompletos"
          value={incompletos.length}
          color="var(--gold-300)"
        />
        <Stat
          label="Bloqueados"
          value={totalBloqueados}
          color="var(--rose-400)"
        />
        <Stat
          label="Em cortesia"
          value={incompletos.length - totalBloqueados}
          color="var(--text-1)"
        />
      </div>

      {incompletos.length > 0 && (
        <LembreteEmLoteButton userIds={incompletos.map((u) => u.id)} />
      )}

      {incompletos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2">
          {incompletos.map((u) => (
            <UsuarioRow key={u.id} u={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function UsuarioRow({
  u,
}: {
  u: {
    id: string;
    nome_exibicao: string | null;
    handle: string | null;
    cidade: string | null;
    estado: string | null;
    telefone: string | null;
    ultimo_ativo: string | null;
    verificado_em: string | null;
    fotosCount: number;
    fotosPerfilCount: number;
    postsComFotoCount: number;
    diasRestantes: number;
    bloqueado: boolean;
    capa: string | null;
  };
}) {
  const cidade = [u.cidade, u.estado].filter(Boolean).join(", ");
  const aprovadoEm = u.verificado_em ? new Date(u.verificado_em) : null;
  const aprovadoFmt = aprovadoEm
    ? aprovadoEm.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";

  return (
    <div
      className="rounded-2xl flex items-center gap-3 p-3"
      style={{
        background: "var(--bg-1)",
        border: u.bloqueado
          ? "1px solid rgba(217,138,114,0.4)"
          : "1px solid var(--line)",
      }}
    >
      {/* Avatar */}
      <Link
        href={`/admin/usuarios/${u.id}`}
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "1px solid var(--gold-600)",
          background: "var(--bg-2)",
          textDecoration: "none",
        }}
      >
        {u.capa ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={u.capa}
            alt=""
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
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/admin/usuarios/${u.id}`}
            className="truncate"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-0)",
              textDecoration: "none",
            }}
          >
            {u.nome_exibicao ?? "Sem nome"}
          </Link>
          {u.handle && (
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--gold-300)" }}
            >
              @{u.handle}
            </span>
          )}
          {u.bloqueado ? (
            <span
              className="mono"
              style={{
                fontSize: 9,
                background: "rgba(217,138,114,0.15)",
                color: "var(--rose-400)",
                padding: "2px 7px",
                borderRadius: 999,
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              BLOQUEADO
            </span>
          ) : (
            <span
              className="mono"
              style={{
                fontSize: 9,
                background: "rgba(212,175,110,0.12)",
                color: "var(--gold-300)",
                padding: "2px 7px",
                borderRadius: 999,
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              {u.diasRestantes === 0
                ? "ÚLTIMO DIA"
                : u.diasRestantes === 1
                  ? "1 DIA RESTANTE"
                  : `${u.diasRestantes} DIAS RESTANTES`}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-2)",
            marginTop: 3,
          }}
        >
          <strong style={{ color: "var(--gold-300)" }}>
            {u.fotosCount}/{MIN_FOTOS}
          </strong>{" "}
          ({u.fotosPerfilCount} perfil
          {u.postsComFotoCount > 0 ? ` + ${u.postsComFotoCount} posts` : ""})
          {cidade && ` · ${cidade}`}
          {` · aprovado em ${aprovadoFmt}`}
        </div>
        {u.telefone && (
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              marginTop: 2,
              letterSpacing: 0.3,
            }}
          >
            📱 {u.telefone}
          </div>
        )}
      </div>

      <LembreteButton userId={u.id} />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-xl px-4 py-2.5"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        minWidth: 130,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </div>
      <div
        className="display"
        style={{
          fontSize: 22,
          fontWeight: 500,
          color,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl text-center"
      style={{
        background: "var(--bg-1)",
        border: "1px dashed var(--line-strong)",
        padding: 40,
      }}
    >
      <div style={{ fontSize: 36 }}>🎉</div>
      <div
        className="display"
        style={{ fontSize: 18, fontWeight: 500, marginTop: 8 }}
      >
        Todo mundo tá com fotos completas
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        Nenhum membro ativo está abaixo do mínimo de {MIN_FOTOS} fotos.
      </div>
    </div>
  );
}
