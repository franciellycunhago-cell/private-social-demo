import { redirect } from "next/navigation";
import { getProfileStatus, routeForStatus } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { getFotoObrigatoria } from "@/lib/app-settings/server";
import { computeFotoGrace, type FotoGraceStatus } from "@/lib/foto-grace";
import { countUserContentFotos } from "@/lib/foto-grace-server";
import { BottomNav } from "./bottom-nav";
import { Heartbeat } from "./heartbeat";
import { FotoGraceBanner } from "./foto-grace-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PushSubscribe } from "@/components/push-subscribe";

/* ====================================================================
 * /app/* layout
 *
 * Guard compartilhado de todas as rotas autenticadas pós-verificação.
 *  - sem user              → /login
 *  - perfil não aprovado   → rota apropriada (onboarding/verificacao)
 *  - aprovado              → renderiza + atualiza ultimo_ativo em BG
 *
 * Também injeta a BottomNav fixa e o starfield de fundo.
 * ================================================================== */

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const info = await getProfileStatus();
  if (!info) redirect("/login");
  if (info.status.state !== "aprovado") {
    redirect(routeForStatus(info.status.state));
  }

  // fire-and-forget: marca o user como ativo
  const supabase = await createClient();
  void supabase.rpc("mark_active");

  // Grace period de fotos: se a flag foto_obrigatoria está ligada,
  // o user tem 5 dias após aprovação pra postar pelo menos 3 fotos
  // públicas. Durante esse período mostramos um banner. Depois disso,
  // sem o mínimo, redireciona pra /primeira-foto.
  // Admin bypassa pra não ficar travado.
  let graceStatus: FotoGraceStatus | null = null;
  if (!info.isAdmin) {
    const fotoObrigatoria = await getFotoObrigatoria();
    if (fotoObrigatoria) {
      // Conta fotos do perfil + publicações com foto. Quem postou no
      // feed já mostrou o rosto / conteúdo — não precisa bloquear.
      const totalConteudo = await countUserContentFotos(
        supabase,
        info.userId,
      );

      graceStatus = computeFotoGrace(
        totalConteudo,
        info.status.profile.verificado_em,
        info.status.profile.created_at,
      );

      if (graceStatus.bloqueado) {
        redirect("/primeira-foto");
      }
    }
  }

  // Contagens iniciais pro badge do bottom nav. RLS limita às conversas
  // e pedidos onde o user é participante — por isso não precisamos
  // filtrar explicitamente por ID aqui.
  const [unreadRes, pedidosRes, notifsRes] = await Promise.all([
    supabase
      .from("mensagens")
      .select("*", { count: "exact", head: true })
      .eq("lido", false)
      .neq("de_id", info.userId),
    supabase
      .from("pedidos_privado")
      .select("*", { count: "exact", head: true })
      .eq("alvo_id", info.userId)
      .eq("status", "pendente"),
    supabase
      .from("notificacoes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", info.userId)
      .eq("lida", false),
  ]);

  const unreadCount = unreadRes.count ?? 0;
  const pedidosCount = pedidosRes.count ?? 0;
  const notifsCount = notifsRes.count ?? 0;

  return (
    <div className="relative min-h-dvh bg-[var(--bg-0)]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 0%, #221410 0%, #0a0706 55%)",
        }}
      />
      <div
        aria-hidden
        className="starry pointer-events-none fixed inset-0 opacity-15"
      />

      <main
        className="relative z-10 mx-auto w-full max-w-md"
        style={{
          // Admin tem chip extra "MODERAÇÃO" abaixo do nav — ~32px a
          // mais. Sem isso, a última linha da tela ficava escondida
          // embaixo do nav pra quem é admin.
          paddingBottom: info.isAdmin ? 132 : 100,
        }}
      >
        {graceStatus && graceStatus.fotosFaltam > 0 && (
          <FotoGraceBanner
            diasRestantes={graceStatus.diasRestantes}
            fotosFaltam={graceStatus.fotosFaltam}
            fotosCount={graceStatus.fotosCount}
          />
        )}
        {children}
      </main>

      <PwaInstallPrompt />
      <PushSubscribe />
      <BottomNav
        isAdmin={info.isAdmin}
        userId={info.userId}
        initialConversasBadge={unreadCount + pedidosCount}
        initialNotificacoesBadge={notifsCount}
      />
      <Heartbeat />
    </div>
  );
}
