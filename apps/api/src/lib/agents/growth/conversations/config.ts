import { prisma } from '../../../prisma';

/** Pesos de scoring (deben sumar 1). */
export type GrowthScoreWeights = {
  /** Alineación problema/pregunta con el artículo. */
  problemFit: number;
  /** Encaje de audiencia / vertical. */
  audienceFit: number;
  /** Señal de actividad reciente (solo si fechas conocidas). */
  recentActivity: number;
  /** Hay espacio para una respuesta útil. */
  usefulReply: number;
  /** Se puede participar (no cerrado / login wall). */
  canParticipate: number;
};

export type GrowthConversationsConfig = {
  autoTriggerOnPublish: boolean;
  maxQueries: number;
  maxSerpResultsPerQuery: number;
  maxPagesToVerify: number;
  maxRecommended: number;
  maxSpendUsd: number;
  locationCode: number;
  languageCode: string;
  market: string;
  estimatedCostPerSerpUsd: number;
  concurrency: number;
  pageTimeoutMs: number;
  maxPageBytes: number;
  /**
   * Weights (documentados):
   * problemFit + audienceFit + recentActivity + usefulReply + canParticipate = 1
   */
  scoreWeights: GrowthScoreWeights;
  minOpportunityScore: number;
};

const DEFAULT_WEIGHTS: GrowthScoreWeights = {
  problemFit: 0.3,
  audienceFit: 0.2,
  recentActivity: 0.15,
  usefulReply: 0.2,
  canParticipate: 0.15,
};

export const DEFAULT_GROWTH_CONVERSATIONS_CONFIG: GrowthConversationsConfig = {
  autoTriggerOnPublish: false,
  maxQueries: 15,
  maxSerpResultsPerQuery: 10,
  maxPagesToVerify: 30,
  maxRecommended: 5,
  maxSpendUsd: 2,
  locationCode: 2032,
  languageCode: 'es',
  market: 'ar',
  estimatedCostPerSerpUsd: 0.002,
  concurrency: 3,
  pageTimeoutMs: 12_000,
  maxPageBytes: 500_000,
  scoreWeights: { ...DEFAULT_WEIGHTS },
  minOpportunityScore: 0.35,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function normalizeWeights(raw: unknown): GrowthScoreWeights {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEIGHTS };
  const o = raw as Record<string, unknown>;
  const w: GrowthScoreWeights = {
    problemFit: asNumber(o.problemFit, DEFAULT_WEIGHTS.problemFit),
    audienceFit: asNumber(o.audienceFit, DEFAULT_WEIGHTS.audienceFit),
    recentActivity: asNumber(o.recentActivity, DEFAULT_WEIGHTS.recentActivity),
    usefulReply: asNumber(o.usefulReply, DEFAULT_WEIGHTS.usefulReply),
    canParticipate: asNumber(o.canParticipate, DEFAULT_WEIGHTS.canParticipate),
  };
  const sum =
    w.problemFit + w.audienceFit + w.recentActivity + w.usefulReply + w.canParticipate;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  if (Math.abs(sum - 1) < 0.02) return w;
  return {
    problemFit: w.problemFit / sum,
    audienceFit: w.audienceFit / sum,
    recentActivity: w.recentActivity / sum,
    usefulReply: w.usefulReply / sum,
    canParticipate: w.canParticipate / sum,
  };
}

export function parseGrowthConversationsSettings(
  settings: unknown,
): GrowthConversationsConfig {
  const root =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>)
      : {};
  const conv =
    root.conversations && typeof root.conversations === 'object'
      ? (root.conversations as Record<string, unknown>)
      : root;

  const d = DEFAULT_GROWTH_CONVERSATIONS_CONFIG;
  return {
    autoTriggerOnPublish: asBool(conv.autoTriggerOnPublish, d.autoTriggerOnPublish),
    maxQueries: clamp(asNumber(conv.maxQueries, d.maxQueries), 10, 20),
    maxSerpResultsPerQuery: clamp(
      asNumber(conv.maxSerpResultsPerQuery, d.maxSerpResultsPerQuery),
      1,
      20,
    ),
    maxPagesToVerify: clamp(asNumber(conv.maxPagesToVerify, d.maxPagesToVerify), 1, 100),
    maxRecommended: clamp(asNumber(conv.maxRecommended, d.maxRecommended), 0, 20),
    maxSpendUsd: Math.max(0, asNumber(conv.maxSpendUsd, d.maxSpendUsd)),
    locationCode: Math.round(asNumber(conv.locationCode, d.locationCode)),
    languageCode: asString(conv.languageCode, d.languageCode),
    market: asString(conv.market, d.market),
    estimatedCostPerSerpUsd: Math.max(
      0,
      asNumber(conv.estimatedCostPerSerpUsd, d.estimatedCostPerSerpUsd),
    ),
    concurrency: clamp(asNumber(conv.concurrency, d.concurrency), 1, 8),
    pageTimeoutMs: clamp(asNumber(conv.pageTimeoutMs, d.pageTimeoutMs), 2000, 60_000),
    maxPageBytes: clamp(asNumber(conv.maxPageBytes, d.maxPageBytes), 50_000, 2_000_000),
    scoreWeights: normalizeWeights(conv.scoreWeights),
    minOpportunityScore: clamp(
      asNumber(conv.minOpportunityScore, d.minOpportunityScore),
      0,
      1,
    ),
  };
}

/** ¿La próxima llamada SERP supera el techo de gasto? */
export function wouldExceedSpendLimit(
  spentUsd: number,
  nextEstimatedUsd: number,
  maxSpendUsd: number,
): boolean {
  return spentUsd + nextEstimatedUsd > maxSpendUsd + 1e-9;
}

export async function resolveGrowthConversationsConfig(
  workspaceId: string,
): Promise<GrowthConversationsConfig> {
  const growth = await prisma.agent.findUnique({ where: { slug: 'growth' } });
  if (!growth) return { ...DEFAULT_GROWTH_CONVERSATIONS_CONFIG };

  const cfg = await prisma.agentConfig.findUnique({
    where: {
      workspaceId_agentId: { workspaceId, agentId: growth.id },
    },
    select: { settings: true },
  });

  return parseGrowthConversationsSettings(cfg?.settings ?? null);
}
