import type {
  Experiencia,
  ProfileRow,
  ProfileTipo,
} from "./supabase/profile";

/* ====================================================================
 * Score de compatibilidade entre dois perfis (0–100%).
 *
 * Peso:
 *   - Intenções em comum        40 pts  (overlap / união)
 *   - Limites/preferências      25 pts  (overlap / união)
 *   - Tipo (casal/homem/mulher) 15 pts  (casal↔casal melhor, solo↔casal ok,
 *                                       homem↔homem pior)
 *   - Experiência               10 pts  (mesma = 10, vizinha = 6, longe = 0)
 *   - Cidade                     5 pts  (mesma cidade)
 *   - Age proximity              5 pts  (diferença <5, <10, <20 anos)
 *
 * Determinístico — os dois lados veem o mesmo %.
 *
 * Não é "compatibilidade romântica real". É um número que dá charme pra
 * UX e guia conversas ("87% — parece que vocês combinam!"). Tunável.
 * ================================================================== */

export type CompatBreakdown = {
  score: number;
  intencoes: number;
  limites: number;
  tipo: number;
  experiencia: number;
  cidade: number;
  idade: number;
};

export type CompatInput = Pick<
  ProfileRow,
  "tipo" | "experiencia" | "intencoes" | "limites" | "cidade" | "idade_1" | "idade_2"
>;

export function calcularCompatibilidade(
  a: CompatInput,
  b: CompatInput,
): CompatBreakdown {
  const intencoes = scoreOverlap(a.intencoes, b.intencoes, 40);
  const limites = scoreOverlap(a.limites, b.limites, 25);
  const tipo = scoreTipo(a.tipo, b.tipo);
  const experiencia = scoreExperiencia(a.experiencia, b.experiencia);
  const cidade = scoreCidade(a.cidade, b.cidade);
  const idade = scoreIdade(a, b);

  const score = Math.min(
    100,
    Math.round(intencoes + limites + tipo + experiencia + cidade + idade),
  );

  return { score, intencoes, limites, tipo, experiencia, cidade, idade };
}

function scoreOverlap(a: string[], b: string[], maxPts: number): number {
  if ((a?.length ?? 0) === 0 || (b?.length ?? 0) === 0) return 0;
  const setA = new Set((a ?? []).map(norm));
  const setB = new Set((b ?? []).map(norm));
  const intersec = [...setA].filter((x) => setB.has(x)).length;
  const uniao = new Set([...setA, ...setB]).size;
  if (uniao === 0) return 0;
  return (intersec / uniao) * maxPts;
}

function scoreTipo(a: ProfileTipo | null, b: ProfileTipo | null): number {
  if (!a || !b) return 5;
  if (a === "casal" && b === "casal") return 15;
  if (a === "casal" || b === "casal") return 10;
  // solo-solo: homem↔mulher > mulher↔mulher > homem↔homem
  if (
    (a === "homem" && b === "mulher") ||
    (a === "mulher" && b === "homem")
  )
    return 12;
  if (a === "mulher" && b === "mulher") return 8;
  return 4; // homem↔homem
}

function scoreExperiencia(
  a: Experiencia | null,
  b: Experiencia | null,
): number {
  if (!a || !b) return 4;
  const order: Record<Experiencia, number> = {
    curioso: 0,
    iniciante: 1,
    experiente: 2,
    veterano: 3,
  };
  const diff = Math.abs(order[a] - order[b]);
  if (diff === 0) return 10;
  if (diff === 1) return 6;
  return 2;
}

function scoreCidade(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return norm(a) === norm(b) ? 5 : 0;
}

function scoreIdade(a: CompatInput, b: CompatInput): number {
  // Usa idade_1 como âncora (perfis casal têm 2 idades, pega a primeira)
  const ageA = a.idade_1 ?? 0;
  const ageB = b.idade_1 ?? 0;
  if (ageA === 0 || ageB === 0) return 2;
  const diff = Math.abs(ageA - ageB);
  if (diff < 5) return 5;
  if (diff < 10) return 3;
  if (diff < 20) return 1;
  return 0;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Label textual pro %. */
export function compatLabel(score: number): string {
  if (score >= 85) return "sintonia rara";
  if (score >= 70) return "combinam bem";
  if (score >= 55) return "tem química";
  if (score >= 40) return "tudo a explorar";
  return "diferentes — pode surpreender";
}
