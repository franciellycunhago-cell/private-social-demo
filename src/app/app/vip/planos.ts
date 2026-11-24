/**
 * Constantes de planos VIP. Não é "use server" pra poder exportar
 * objetos (server actions só permitem async functions).
 */
export type VipPlano = "mensal" | "trimestral" | "anual";

export const PLANOS_INFO: Record<
  VipPlano,
  {
    valorCentavos: number;
    valorLabel: string;
    perMes: string;
    descontoLabel: string | null;
  }
> = {
  mensal: {
    valorCentavos: 990,
    valorLabel: "R$ 9,90",
    perMes: "R$ 9,90/mês",
    descontoLabel: null,
  },
  trimestral: {
    valorCentavos: 2490,
    valorLabel: "R$ 24,90",
    perMes: "≈ R$ 8,30/mês",
    descontoLabel: "16% off",
  },
  anual: {
    valorCentavos: 8990,
    valorLabel: "R$ 89,90",
    perMes: "≈ R$ 7,49/mês",
    descontoLabel: "25% off",
  },
};
