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
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
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

/** Próxima oportunidad en cola (solo status=queued) para el estratega. */
export async function pickNextOpportunityTopic(workspaceId: string): Promise<{
  topic: string;
  keyword: string;
  opportunityId: string;
  stage: FunnelStage;
  cluster: string;
} | null> {
  const chosen = await prisma.keywordOpportunity.findFirst({
    where: { workspaceId, status: 'queued' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  if (!chosen) return null;

  return {
    topic: chosen.keyword,
    keyword: chosen.keyword,
    opportunityId: chosen.id,
    stage: chosen.stage,
    cluster: chosen.cluster,
  };
}

export async function markOpportunityInProgress(workspaceId: string, opportunityId: string) {
  await prisma.keywordOpportunity.updateMany({
    where: { id: opportunityId, workspaceId },
    data: { status: 'in_progress' },
  });
}

export function keywordsMatch(a: string, b: string): boolean {
  return normalizeKeyword(a) === normalizeKeyword(b);
}
