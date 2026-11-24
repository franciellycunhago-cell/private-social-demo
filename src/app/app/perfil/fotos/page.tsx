import { redirect } from "next/navigation";

/* ====================================================================
 * /app/perfil/fotos — desativada após unificação fotos/posts.
 *
 * Galeria de fotos públicas foi removida. Usuário gerencia conteúdo
 * via posts (no perfil) e usa o lápis pra trocar foto de capa.
 * Esta rota redireciona pra /app/perfil pra não quebrar bookmarks.
 * ================================================================== */

export default function FotosPublicasRedirecionar() {
  redirect("/app/perfil");
}
