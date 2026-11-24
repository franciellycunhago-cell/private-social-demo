import Link from "next/link";
import Image from "next/image";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const metadata = {
  title: "Buscar token — Admin",
};

/* ====================================================================
 * /admin/buscar-token
 *
 * Reversão do token de marca dágua. Admin cola o token (ex: TC-A7F2K9
 * — visível em foto vazada) e identifica de qual conta veio.
 *
 *  - Token = "TC-" + primeiros 6 chars hex do profile.id (UUID)
 *  - Busca: WHERE replace(id::text, '-', '') LIKE 'XXXXXX%'
 *  - Geralmente retorna 1 perfil; em colisão astronômica (16.7M
 *    combinações) pode voltar mais de um e o admin desempata
 *    pelo @handle/cidade
 * ================================================================== */

type SearchParams = Promise<{ t?: string }>;

type Resultado = {
  id: string;
  nome: string;
  handle: string | null;
  cidade: string | null;
  estado: string | null;
  verificado: boolean;
  vipAte: string | null;
  ultimoAtivo: string | null;
  trustScore: number;
  capa: string | null;
  denunciasCount: number;
  email: string | null;
};

export default async function BuscarTokenPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t: rawToken } = await searchParams;
  const inputToken = (rawToken ?? "").trim();

  // Remove prefixo TC- explicitamente PRIMEIRO. A regex [^0-9a-fA-F]
  // não pegaria o "C" de "TC-" porque C é hex válido — daria "CCFAEED"
  // pra um token "TC-CFAEED".
  const semPrefixo = inputToken.replace(/^TC-?/i, "");
  const hex = semPrefixo.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  const valid = hex.length >= 4 && hex.length <= 32;

  let resultados: Resultado[] = [];
  let warning: string | null = null;

  if (inputToken && !valid) {
    warning =
      "Token inválido. Cole o token completo (ex: TC-A7F2K9) ou só os caracteres hex.";
  } else if (valid) {
    const admin = adminClient();
    const padrao = hex.length >= 6 ? hex.slice(0, 6) : hex;

    type ProfileLite = {
      id: string;
      nome_exibicao: string | null;
      handle: string | null;
      cidade: string | null;
      estado: string | null;
      verificado: boolean;
      vip_ate: string | null;
      ultimo_ativo: string | null;
      trust_score: number;
    };

    // 1. RPC dedicada (instantâneo)
    let profilesRaw: ProfileLite[] = [];
    try {
      const { data: viaRpc } = await admin.rpc("admin_buscar_token", {
        p_prefix: padrao,
      });
      if (Array.isArray(viaRpc)) {
        profilesRaw = viaRpc as ProfileLite[];
      }
    } catch {
      /* RPC ainda não criada → cai pro fallback */
    }

    // 2. Fallback paginado quando RPC volta vazio (cobre o caso da
    // RPC ainda não estar criada no banco)
    if (profilesRaw.length === 0) {
      const acumulado: ProfileLite[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (offset < 50000) {
        const { data: chunk } = await admin
          .from("profiles")
          .select(
            "id, nome_exibicao, handle, cidade, estado, verificado, vip_ate, ultimo_ativo, trust_score",
          )
          .range(offset, offset + PAGE - 1);
        const arr = (chunk ?? []) as ProfileLite[];
        if (arr.length === 0) break;
        const matches = arr.filter((p) =>
          p.id.replace(/-/g, "").toUpperCase().startsWith(padrao),
        );
        acumulado.push(...matches);
        if (acumulado.length >= 20 || arr.length < PAGE) break;
        offset += PAGE;
      }
      profilesRaw = acumulado;
    }

    if (profilesRaw.length > 0) {
      const ids = profilesRaw.map((p) => p.id);
      const [fotosRes, denunciasRes, authRes] = await Promise.all([
        admin
          .from("fotos")
          .select("profile_id, url")
          .in("profile_id", ids)
          .eq("tipo", "publica")
          .order("ordem", { ascending: true }),
        admin
          .from("denuncias")
          .select("denunciado_id, status")
          .in("denunciado_id", ids),
        admin.auth.admin.listUsers({ perPage: 200 }),
      ]);

      const capaMap = new Map<string, string>();
      (fotosRes.data ?? []).forEach((f) => {
        const pid = f.profile_id as string;
        if (!capaMap.has(pid)) {
          const { data } = admin.storage
            .from("fotos-publicas")
            .getPublicUrl(f.url as string);
          capaMap.set(pid, data.publicUrl);
        }
      });

      const denunciasCount = new Map<string, number>();
      (denunciasRes.data ?? []).forEach((d) => {
        const id = d.denunciado_id as string;
        denunciasCount.set(id, (denunciasCount.get(id) ?? 0) + 1);
      });

      const emailMap = new Map<string, string>();
      const users = authRes.data?.users ?? [];
      users.forEach((u) => {
        if (u.id && u.email) emailMap.set(u.id, u.email);
      });

      resultados = profilesRaw.map((p) => ({
        id: p.id,
        nome: p.nome_exibicao ?? "Sem nome",
        handle: p.handle,
        cidade: p.cidade,
        estado: p.estado,
        verificado: p.verificado,
        vipAte: p.vip_ate,
        ultimoAtivo: p.ultimo_ativo,
        trustScore: p.trust_score,
        capa: capaMap.get(p.id) ?? null,
        denunciasCount: denunciasCount.get(p.id) ?? 0,
        email: emailMap.get(p.id) ?? null,
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="display"
          style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Buscar por token
        </h1>
        <p
          className="mt-1"
          style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 560 }}
        >
          Cole o token visível em uma foto vazada (ex:{" "}
          <code style={{ color: "var(--gold-300)" }}>TC-A7F2K9</code>) pra
          identificar de qual conta veio a captura. O token corresponde aos
          primeiros 6 caracteres do UUID interno do perfil.
        </p>
      </header>

      <form
        method="get"
        action="/admin/buscar-token"
        className="flex gap-2 flex-wrap"
      >
        <input
          name="t"
          defaultValue={inputToken}
          placeholder="TC-A7F2K9"
          className="mono"
          style={{
            flex: 1,
            minWidth: 220,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "11px 14px",
            color: "var(--text-0)",
            fontSize: 14,
            letterSpacing: 1,
            outline: "none",
          }}
          autoFocus
        />
        <button type="submit" className="btn-gold" style={{ padding: "10px 22px" }}>
          Buscar
        </button>
      </form>

      {warning && (
        <div
          role="alert"
          className="rounded-xl p-3"
          style={{
            background: "rgba(217,138,114,0.08)",
            border: "1px solid rgba(217,138,114,0.3)",
            color: "var(--rose-400)",
            fontSize: 13,
          }}
        >
          {warning}
        </div>
      )}

      {valid && resultados.length === 0 && !warning && (
        <div
          className="card flex flex-col items-center text-center gap-2"
          style={{ padding: 36 }}
        >
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            Nenhum perfil encontrado
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              maxWidth: 360,
              lineHeight: 1.5,
            }}
          >
            Confere o token. Pode ter sido lido errado da foto — confunde fácil
            entre 0/O, 1/I, 8/B.
          </div>
        </div>
      )}

      {resultados.length > 1 && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "rgba(212,175,110,0.10)",
            border: "1px solid var(--gold-600)",
            color: "var(--gold-300)",
            fontSize: 12,
          }}
        >
          {resultados.length} perfis batem com esse prefixo (colisão rara).
          Use @handle, cidade ou email pra desempatar.
        </div>
      )}

      {resultados.map((r) => (
        <div
          key={r.id}
          className="card flex flex-col gap-3"
          style={{ padding: 18 }}
        >
          <div className="flex items-center gap-4">
            <div
              className="relative overflow-hidden flex-shrink-0"
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                border: "1px solid var(--gold-600)",
                background: "var(--bg-2)",
              }}
            >
              {r.capa ? (
                <Image
                  src={r.capa}
                  alt=""
                  fill
                  sizes="72px"
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="display"
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "var(--text-0)",
                  }}
                >
                  {r.nome}
                </span>
                {r.handle && (
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--text-3)" }}
                  >
                    @{r.handle}
                  </span>
                )}
                {r.verificado && (
                  <span
                    className="chip"
                    style={{
                      fontSize: 10,
                      color: "var(--gold-300)",
                      borderColor: "var(--gold-600)",
                    }}
                  >
                    ✓ Verificado
                  </span>
                )}
              </div>
              <div
                style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}
              >
                {[r.cidade, r.estado].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            style={{ fontSize: 12 }}
          >
            <Field label="Token" value={`TC-${r.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`} mono />
            <Field
              label="Trust"
              value={`${r.trustScore}%`}
              accent={r.trustScore < 50}
            />
            <Field
              label="VIP"
              value={
                r.vipAte && new Date(r.vipAte) > new Date()
                  ? new Date(r.vipAte).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Field
              label="Último ativo"
              value={
                r.ultimoAtivo
                  ? new Date(r.ultimoAtivo).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <Field
              label="Denúncias"
              value={`${r.denunciasCount}`}
              accent={r.denunciasCount > 0}
            />
            <Field label="Email" value={r.email ?? "—"} mono />
            <Field label="UUID" value={r.id} mono small />
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <Link
              href={`/app/p/${r.id}`}
              target="_blank"
              className="btn-ghost"
              style={{ fontSize: 12, padding: "7px 14px" }}
            >
              Ver perfil ↗
            </Link>
            <Link
              href={`/admin/denuncias`}
              className="btn-ghost"
              style={{ fontSize: 12, padding: "7px 14px" }}
            >
              Denúncias do alvo
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  small,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        padding: "8px 12px",
        minWidth: 0,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? "mono" : undefined}
        style={{
          fontSize: small ? 10 : 13,
          color: accent ? "var(--rose-400)" : "var(--text-1)",
          fontWeight: accent ? 600 : 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
