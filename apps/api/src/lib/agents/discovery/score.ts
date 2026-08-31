import type { MonthlySearchPoint } from '../../integrations/dataforseo';

/** Volumen → 0–100 (log). */
export function scoreDemandFromVolume(monthlySearches: number | null | undefined): number {
  const v = monthlySearches ?? 0;
  if (v <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(v + 1) * 33));
}

/**
 * Tendencia 0–100 a partir de monthly_searches de Keyword Planner.
 * Compara promedio últimos 3 meses vs 3–9 meses anteriores.
 */
export function scoreTrendFromMonthly(
  monthly: MonthlySearchPoint[] | null | undefined,
): { score: number; label: 'growing' | 'stable' | 'declining' } {
  if (!monthly?.length) {
    return { score: 50, label: 'stable' };
  }

  const sorted = [...monthly]
    .filter((m) => m && typeof m.year === 'number' && typeof m.month === 'number')
    .sort((a, b) => a.year - b.year || a.month - b.month);

  if (sorted.length < 4) {
    return { score: 50, label: 'stable' };
  }

  const volumes = sorted.map((m) => Math.max(0, m.search_volume ?? 0));
  const recent = volumes.slice(-3);
  const older = volumes.slice(Math.max(0, volumes.length - 9), -3);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const r = avg(recent);
  const o = avg(older);

  if (o <= 0 && r <= 0) return { score: 40, label: 'stable' };
  if (o <= 0 && r > 0) return { score: 90, label: 'growing' };

  const ratio = r / o;
  // ratio 0.5 → ~20, 1.0 → 50, 1.5 → 80, 2+ → 95
  const score = Math.max(0, Math.min(100, Math.round(50 + (ratio - 1) * 60)));
  const label: 'growing' | 'stable' | 'declining' =
    ratio >= 1.15 ? 'growing' : ratio <= 0.85 ? 'declining' : 'stable';

  return { score, label };
}

/**
 * Opportunity Score MVP:
 * Demanda × 0.35 + Tendencia × 0.25 + Relevancia × 0.40
 */
export function computeOpportunityScore(
  demand: number,
  trend: number,
  relevance: number,
): number {
  return Math.round(
    Math.min(100, Math.max(0, demand * 0.35 + trend * 0.25 + relevance * 0.4)),
  );
}

export function relevanceLabel(score: number): 'very_high' | 'high' | 'medium' | 'low' {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

export function intentToStage(
  intent: string,
): 'tofu' | 'mofu' | 'bofu' {
  const i = intent.toLowerCase();
  if (i === 'transactional' || i === 'navigational') return 'bofu';
  if (i === 'commercial' || i === 'comparison') return 'mofu';
  return 'tofu';
}
