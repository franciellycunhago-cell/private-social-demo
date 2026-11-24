/**
 * Constantes pra VIP cortesia. Não é "use server" pra poder exportar
 * objetos (server actions só permitem async functions).
 */

export type CortesiaPeriodo = "1mes" | "3meses" | "1ano" | "vitalicio";

export const CORTESIA_PERIODOS_LABEL: Record<CortesiaPeriodo, string> = {
  "1mes": "1 mês",
  "3meses": "3 meses",
  "1ano": "1 ano",
  vitalicio: "Vitalício",
};
