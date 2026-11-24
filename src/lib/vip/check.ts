/**
 * Helpers pra checar se um perfil tem acesso a features VIP.
 *
 * Regra: o user tem acesso VIP se:
 *  - profiles.vip_ate > now()  (assinatura paga ou cortesia ativa)
 *  - OU é admin (acesso completo pra teste/moderação)
 */

export function vipAteIsValid(vipAte: string | null | undefined): boolean {
  if (!vipAte) return false;
  return new Date(vipAte) > new Date();
}

/**
 * Retorna true se o user pode usar features VIP.
 * Admin sempre tem acesso, mesmo sem assinatura.
 */
export function hasVipAccess(
  vipAte: string | null | undefined,
  isAdmin: boolean | undefined,
): boolean {
  if (isAdmin) return true;
  return vipAteIsValid(vipAte);
}
