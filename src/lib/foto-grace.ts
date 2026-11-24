/* ====================================================================
 * Grace period de fotos
 *
 * Regra: usuário tem GRACE_DAYS dias depois da aprovação pra postar
 * pelo menos MIN_FOTOS fotos públicas. Durante esse período pode
 * usar o app normalmente, mas vê um banner lembrando. Depois disso,
 * sem o mínimo de fotos, é redirecionado pra tela de upload.
 *
 * Admin bypassa toda essa lógica.
 * ================================================================== */

export const GRACE_DAYS = 5;
export const MIN_FOTOS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type FotoGraceStatus = {
  /** Quantas fotos públicas o user tem hoje. */
  fotosCount: number;
  /** Quantas faltam pra bater o mínimo. 0 se já atingiu. */
  fotosFaltam: number;
  /** Dias restantes no período de cortesia. 0 quando estourou. */
  diasRestantes: number;
  /** True se o user já estourou a cortesia e tem menos que o mínimo —
   *  precisa ser redirecionado pra tela de upload. */
  bloqueado: boolean;
};

/**
 * Calcula o status do grace period.
 * @param fotosCount Quantidade de fotos públicas ativas do user
 * @param verificadoEm Quando o admin aprovou (ISO string) — referência primária
 * @param createdAt Quando o user criou a conta (fallback se verificadoEm null)
 */
export function computeFotoGrace(
  fotosCount: number,
  verificadoEm: string | null,
  createdAt: string | null,
): FotoGraceStatus {
  const fotosFaltam = Math.max(0, MIN_FOTOS - fotosCount);

  // Já tem o mínimo → tudo certo
  if (fotosFaltam === 0) {
    return {
      fotosCount,
      fotosFaltam: 0,
      diasRestantes: GRACE_DAYS,
      bloqueado: false,
    };
  }

  const refData = verificadoEm ?? createdAt;
  // Sem referência (caso muito edge) → não bloqueia ainda
  if (!refData) {
    return {
      fotosCount,
      fotosFaltam,
      diasRestantes: GRACE_DAYS,
      bloqueado: false,
    };
  }

  const elapsedMs = Date.now() - new Date(refData).getTime();
  const elapsedDays = elapsedMs / MS_PER_DAY;
  const diasRestantes = Math.max(0, Math.ceil(GRACE_DAYS - elapsedDays));
  const bloqueado = elapsedDays >= GRACE_DAYS;

  return {
    fotosCount,
    fotosFaltam,
    diasRestantes,
    bloqueado,
  };
}
