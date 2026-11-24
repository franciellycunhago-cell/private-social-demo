import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export const metadata = {
  title: "Admin — PrivateSocial",
};

/* ====================================================================
 * Layout /admin
 * - Server Component: só renderiza se user estiver em public.admins
 * - Sidebar fixa à esquerda (reference: admin-base.jsx)
 * ================================================================== */

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("profile_id, nivel")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!adminRow) redirect("/app");

  // 2FA TOTP foi pausado por decisão do cliente (UX 8h cobrar código).
  // Lib + páginas /admin/2fa/* continuam no repo pra reativar quando
  // quiser — basta restaurar o bloco abaixo. Arquivos:
  //   - lib/admin-totp/server.ts
  //   - app/admin/2fa/{page,verify-form,actions}.tsx
  //   - app/admin/2fa/setup/{page,setup-form,actions}.tsx
  //
  // const reqHeaders = await headers();
  // const path = reqHeaders.get("x-pathname") ?? "";
  // const fora2fa = !path.startsWith("/admin/2fa");
  // if (fora2fa) {
  //   const totp = await getAdminTotpState(user.id);
  //   if (totp.state === "nao_configurado") redirect("/admin/2fa/setup");
  //   if (!totp.verificadoRecente) redirect("/admin/2fa");
  // }

  const [pendingCount, denunciasCount] = await Promise.all([
    supabase
      .from("verificacoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .then((r) => r.count ?? 0),
    supabase
      .from("denuncias")
      .select("id", { count: "exact", head: true })
      .eq("status", "aberta")
      .then((r) => r.count ?? 0),
  ]);

  return (
    <div className="min-h-dvh bg-[var(--bg-0)] text-[var(--text-0)]">
      <div
        className="flex"
        style={{ minHeight: "100dvh" }}
      >
        {/* Sidebar */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            width: 240,
            borderRight: "1px solid var(--line)",
            background: "rgba(10,7,6,0.85)",
            backdropFilter: "blur(20px)",
            position: "sticky",
            top: 0,
            height: "100dvh",
          }}
        >
          <div
            className="flex items-center gap-2.5 px-5"
            style={{
              paddingTop: 22,
              paddingBottom: 22,
              borderBottom: "1px solid var(--line)",
            }}
          >
            <Image
              src="/logo-icon.png"
              alt="PrivateSocial"
              width={32}
              height={32}
              className="object-contain"
            />
            <div>
              <div
                className="display"
                style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}
              >
                PrivateSocial
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  color: "var(--gold-400)",
                  textTransform: "uppercase",
                }}
              >
                Admin
              </div>
            </div>
          </div>

          <nav
            className="flex-1 flex flex-col gap-0.5 px-3 py-4 overflow-auto scroll"
          >
            <NavSection>Comunidade</NavSection>
            <NavLink href="/admin/moderacao" badge={pendingCount || undefined}>
              Moderação
            </NavLink>
            <NavLink href="/admin/denuncias" badge={denunciasCount || undefined}>
              Denúncias
            </NavLink>
            <NavLink href="/admin/buscar-token">Buscar token</NavLink>
            <NavLink href="/admin/usuarios">Usuários</NavLink>
            <NavLink href="/admin/usuarios-incompletos">
              Fotos incompletas
            </NavLink>
            <NavSection>Conteúdo</NavSection>
            <NavLink href="/admin/eventos">Eventos</NavLink>
            <NavLink href="/admin/assinaturas">Assinaturas</NavLink>
            <NavSection>Sistema</NavSection>
            <NavLink href="/admin/configuracoes">Configurações</NavLink>
          </nav>

          <div
            className="flex items-center gap-2.5 px-4"
            style={{
              paddingTop: 14,
              paddingBottom: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div
              className="grid place-items-center rounded-full flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                background: "var(--shine-gold)",
                color: "#1a0f05",
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {(user.email?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {adminRow.nivel === "super" ? "Super admin" : "Moderador"}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="mono"
                aria-label="Sair"
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  padding: "5px 9px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                sair
              </button>
            </form>
          </div>
        </aside>

        {/* Main column */}
        <main className="flex-1 min-w-0">
          {/* Topbar mobile */}
          <div
            className="md:hidden flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <Link href="/admin/moderacao" className="flex items-center gap-2">
              <Image
                src="/logo-icon.png"
                alt=""
                width={28}
                height={28}
                className="object-contain"
              />
              <span
                className="display"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Admin
              </span>
            </Link>
            <Link
              href="/app"
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--gold-400)",
                textDecoration: "none",
              }}
            >
              Ir pro app →
            </Link>
          </div>

          {/* Tabs mobile pra navegar entre as áreas (no desktop a sidebar
              já cobre, então escondemos aqui) */}
          <div
            className="md:hidden flex items-center gap-1.5 px-4 py-3 overflow-x-auto scroll"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <MobileTab
              href="/admin/moderacao"
              label="Moderação"
              badge={pendingCount || undefined}
            />
            <MobileTab
              href="/admin/denuncias"
              label="Denúncias"
              badge={denunciasCount || undefined}
            />
            <MobileTab href="/admin/buscar-token" label="Token" />
            <MobileTab href="/admin/usuarios" label="Usuários" />
            <MobileTab href="/admin/eventos" label="Eventos" />
            <MobileTab href="/admin/configuracoes" label="Config" />
            <form action={signOut} className="ml-auto">
              <button
                type="submit"
                className="mono"
                aria-label="Sair"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  padding: "5px 9px",
                  borderRadius: 8,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                sair
              </button>
            </form>
          </div>

          <div className="px-6 py-6 md:px-10 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MobileTab({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex-shrink-0 flex items-center gap-1.5 rounded-full"
      style={{
        padding: "6px 12px",
        background: "rgba(212,175,110,0.06)",
        border: "1px solid var(--line-strong)",
        color: "var(--text-1)",
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavSection({ children }: { children: ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "var(--text-3)",
        padding: "14px 12px 6px",
      }}
    >
      {children}
    </div>
  );
}

function NavLink({
  href,
  children,
  badge,
  disabled,
}: {
  href: string;
  children: ReactNode;
  badge?: number;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        className="px-3 py-2.5 rounded-lg flex items-center justify-between"
        style={{
          fontSize: 13,
          color: "var(--text-3)",
          opacity: 0.55,
          cursor: "not-allowed",
        }}
      >
        <span>{children}</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors"
      style={{
        fontSize: 13,
        color: "var(--text-1)",
        textDecoration: "none",
      }}
    >
      <span>{children}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--shine-gold)",
            color: "#1a0f05",
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
