import type { FunnelStage, KeywordOpportunityStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { expandSeedKeyword, normalizeKeyword } from './keyword-cloud';

export type ListOpportunitiesFilters = {
  workspaceId: string;
  status?: KeywordOpportunityStatus;
  stage?: FunnelStage;
  cluster?: string;
  seedKeyword?: string;
};

export async function listKeywordOpportunities(filters: ListOpportunitiesFilters) {
  const where: Prisma.KeywordOpportunityWhereInput = {
    workspaceId: filters.workspaceId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.stage ? { stage: filters.stage } : {}),
    ...(filters.cluster ? { cluster: filters.cluster } : {}),
    ...(filters.seedKeyword ? { seedKeyword: filters.seedKeyword } : {}),
  };

  const opportunities = await prisma.keywordOpportunity.findMany({
    where,
    orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }, { demandScore: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  const seeds = await prisma.keywordOpportunity.findMany({
    where: { workspaceId: filters.workspaceId },
    distinct: ['seedKeyword'],
    select: { seedKeyword: true },
    orderBy: { seedKeyword: 'asc' },
  });

  const clusters = await prisma.keywordOpportunity.findMany({
    where: { workspaceId: filters.workspaceId },
    distinct: ['cluster'],
    select: { cluster: true },
    orderBy: { cluster: 'asc' },
  });

  const byStage = { tofu: 0, mofu: 0, bofu: 0 };
  for (const op of opportunities) {
    byStage[op.stage] += 1;
  }

  return {
    opportunities,
    seeds: seeds.map((s) => s.seedKeyword),
    clusters: clusters.map((c) => c.cluster),
    summary: {
      total: opportunities.length,
      byStage,
      byStatus: opportunities.reduce<Record<string, number>>((acc, op) => {
        acc[op.status] = (acc[op.status] ?? 0) + 1;
        return acc;
      }, {}),
    },
  };
}

/**
 * Carga seeds, genera cloud (LLM o reglas) y persiste sin duplicar keywords.
 */
export async function ingestSeedKeywords(
  workspaceId: string,
  seeds: string[],
  opts?: { expand?: boolean },
) {
  const expand = opts?.expand !== false;
  const cleanSeeds = [
    ...new Set(
      seeds
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length >= 2 && s.length <= 160),
    ),
  ];

  if (!cleanSeeds.length) {
    throw new Error('Agregá al menos una keyword semilla');
  }

  let created = 0;
  let skipped = 0;
  const sources: string[] = [];

  for (const seed of cleanSeeds) {
    const expansion = expand
      ? await expandSeedKeyword(seed)
      : {
          items: [
            {
              keyword: seed,
              cluster: `Cluster: ${seed}`,
              stage: 'mofu' as const,
              intent: 'commercial',
              intentLabel: 'Keyword semilla',
              priority: 90,
            },
          ],
          source: 'manual' as const,
        };

    sources.push(expansion.source);

    for (const item of expansion.items) {
      const keyword = item.keyword.replace(/\s+/g, ' ').trim();
      if (!keyword) continue;

      try {
        await prisma.keywordOpportunity.create({
          data: {
            workspaceId,
            seedKeyword: seed,
            keyword,
            cluster: item.cluster,
            stage: item.stage,
            intent: item.intent,
            intentLabel: item.intentLabel,
            priority: item.priority,
            source: expansion.source === 'llm' ? 'llm_expand' : expansion.source === 'rules' ? 'rules_expand' : 'manual',
            status: 'idea',
          },
        });
        created += 1;
      } catch {
        // unique (workspaceId, keyword) — ya existe
        skipped += 1;
      }
    }
  }

  return {
    seeds: cleanSeeds,
    created,
    skipped,
    source: sources.includes('llm') ? 'llm' : sources.includes('rules') ? 'rules' : 'manual',
  };
}

export async function updateKeywordOpportunity(
  workspaceId: string,
  id: string,
  data: {
    status?: KeywordOpportunityStatus;
    priority?: number;
    notes?: string | null;
    cluster?: string;
    stage?: FunnelStage;
    intentLabel?: string | null;
  },
) {
  const existing = await prisma.keywordOpportunity.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) throw new Error('Oportunidad no encontrada');

  return prisma.keywordOpportunity.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.cluster !== undefined ? { cluster: data.cluster } : {}),
      ...(data.stage !== undefined ? { stage: data.stage } : {}),
      ...(data.intentLabel !== undefined ? { intentLabel: data.intentLabel } : {}),
    },
  });
}

export async function deleteKeywordOpportunity(workspaceId: string, id: string) {
  const existing = await prisma.keywordOpportunity.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) throw new Error('Oportunidad no encontrada');
  await prisma.keywordOpportunity.delete({ where: { id } });
  return { ok: true };
}

/** Próxima oportunidad para el estratega: encoladas primero, si no hay, ideas por prioridad. */
export async function pickNextOpportunityTopic(workspaceId: string): Promise<{
  topic: string;
  keyword: string;
  opportunityId: string;
  stage: FunnelStage;
  cluster: string;
} | null> {
  const queued = await prisma.keywordOpportunity.findFirst({
    where: { workspaceId, status: 'queued' },
    orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
  });
  if (queued) {
    return {
      topic: queued.keyword,
      keyword: queued.keyword,
      opportunityId: queued.id,
      stage: queued.stage,
      cluster: queued.cluster,
    };
  }

  // Autonomía: sin clicks de "Encolar", Teo toma la idea de mayor oportunidad/prioridad.
  const idea = await prisma.keywordOpportunity.findFirst({
    where: { workspaceId, status: 'idea' },
    orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }],
  });
  if (!idea) return null;

  return {
    topic: idea.keyword,
    keyword: idea.keyword,
    opportunityId: idea.id,
    stage: idea.stage,
    cluster: idea.cluster,
  };
}

export async function markOpportunityInProgress(workspaceId: string, opportunityId: string) {
  await prisma.keywordOpportunity.updateMany({
    where: { id: opportunityId, workspaceId },
    data: { status: 'in_progress' },
  });
}

export async function markOpportunityCovered(workspaceId: string, opportunityId: string) {
  await prisma.keywordOpportunity.updateMany({
    where: { id: opportunityId, workspaceId },
    data: { status: 'covered' },
  });
}

/** Si una misión falla, la oportunidad vuelve a idea para reintentar. */
export async function releaseOpportunity(workspaceId: string, opportunityId: string) {
  await prisma.keywordOpportunity.updateMany({
    where: { id: opportunityId, workspaceId, status: 'in_progress' },
    data: { status: 'idea' },
  });
}

/**
 * Asegura cloud de oportunidades a partir de las semillas del workspace.
 * Idempotente: no regenera seeds que ya tienen keywords abiertas.
 */
export async function ensureOpportunityCloudFromSeeds(
  workspaceId: string,
  seeds: string[],
): Promise<{ created: number; skippedSeeds: number; source: string }> {
  const cleanSeeds = [
    ...new Set(
      seeds
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length >= 2 && s.length <= 160),
    ),
  ];
  if (!cleanSeeds.length) return { created: 0, skippedSeeds: 0, source: 'none' };

  const openBySeed = await prisma.keywordOpportunity.groupBy({
    by: ['seedKeyword'],
    where: {
      workspaceId,
      seedKeyword: { in: cleanSeeds },
      status: { in: ['idea', 'queued', 'in_progress'] },
    },
    _count: { _all: true },
  });
  const covered = new Set(
    openBySeed.filter((row) => row._count._all > 0).map((row) => row.seedKeyword),
  );

  const missing = cleanSeeds.filter((s) => !covered.has(s));
  if (!missing.length) {
    return { created: 0, skippedSeeds: cleanSeeds.length, source: 'existing' };
  }

  const result = await ingestSeedKeywords(workspaceId, missing, { expand: true });
  return {
    created: result.created,
    skippedSeeds: cleanSeeds.length - missing.length,
    source: result.source,
  };
}

/**
 * Tick autónomo: toma topics de Teo y genera cloud si falta.
 * También libera oportunidades "in_progress" viejas (>48h) por si falló una misión.
 */
export async function tickOpportunityCloud(): Promise<{
  workspaces: number;
  created: number;
  released: number;
}> {
  const configs = await prisma.agentConfig.findMany({
    where: { agent: { slug: 'teo' } },
    select: { workspaceId: true, topics: true },
  });

  let created = 0;
  let released = 0;
  let touched = 0;

  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const freed = await prisma.keywordOpportunity.updateMany({
    where: { status: 'in_progress', updatedAt: { lt: staleBefore } },
    data: { status: 'idea' },
  });
  released = freed.count;

  for (const config of configs) {
    const topics = Array.isArray(config.topics)
      ? (config.topics as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    if (!topics.length) continue;
    touched += 1;
    const result = await ensureOpportunityCloudFromSeeds(config.workspaceId, topics);
    created += result.created;
    if (result.created > 0) {
      console.log(
        `[opportunities] cloud autónomo workspace=${config.workspaceId} +${result.created} (${result.source})`,
      );
    }
  }

  return { workspaces: touched, created, released };
}

export function keywordsMatch(a: string, b: string): boolean {
  return normalizeKeyword(a) === normalizeKeyword(b);
}
