/**
 * Gera um token de rastreamento curto e estável a partir do user.id
 * (UUID). 6 chars hex em caixa alta com prefixo "TC-".
 *
 * Determinístico: mesmo user gera sempre o mesmo token.
 * Reverso só pelo admin via /admin/buscar-token (compara com profile.id).
 *
 * Em arquivo separado (sem "use client") pra ser importável tanto
 * de server quanto de client components sem boundary issues.
 */
export function makeViewerToken(userId: string): string {
  const hex = userId.replace(/-/g, "").toUpperCase();
  return `TC-${hex.slice(0, 6)}`;
}
