import type { GrowthMetricKind, Prisma } from '@prisma/client';
import {
  fetchGa4SessionsByCampaignContent,
} from '../../../integrations/google-ga4';
import {
  hasGa4Configured,
  resolveGoogleMetricsConfig,
} from '../../../integrations/google-config';
import { prisma } from '../../../prisma';

export type RegisterManualMetricInput = {
  workspaceId: string;
  interventionId: string;
  kind: Exclude<GrowthMetricKind, 'ga4_sessions'>;
  value: number;
  notes?: string | null;
  capturedAt?: Date;
  registeredByHint?: string | null;
};

/**
 * Recolecta métricas GA4 por attributionId.
 * Si no hay dato: valueKnown=false y value=null (NUNCA guardar 0 como éxito).
 */
export async function collectInterventionMetrics(
  workspaceId: string,
  interventionId?: string,
): Promise<{ updated: number; skipped: number }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  if (!workspace) return { updated: 0, skipped: 0 };

  const config = resolveGoogleMetricsConfig(workspace.slug);
  if (!hasGa4Configured(config) || !config) {
    return { updated: 0, skipped: 0 };
  }

  const interventions = await prisma.growthIntervention.findMany({
    where: {
      workspaceId,
      ...(interventionId ? { id: interventionId } : {}),
    },
    select: { id: true, attributionId: true },
  });
  if (!interventions.length) return { updated: 0, skipped: 0 };

  const attributionIds = interventions.map((i) => i.attributionId);
  let rows: Awaited<ReturnType<typeof fetchGa4SessionsByCampaignContent>> = [];
  try {
    rows = await fetchGa4SessionsByCampaignContent(config, {
      days: 28,
      attributionIds,
    });
  } catch (err) {
    console.warn(
      '[growth-conversations] GA4 metrics error',
      err instanceof Error ? err.message : err,
    );
    // Sin inventar ceros: marcamos unknown
    const now = new Date();
    for (const iv of interventions) {
      await prisma.growthInterventionMetric.create({
        data: {
          workspaceId,
          interventionId: iv.id,
          kind: 'ga4_sessions',
          value: null,
          valueKnown: false,
          source: 'ga4',
          capturedAt: now,
          notes: 'GA4 no disponible o error de fetch',
          provenance: err instanceof Error ? err.message : String(err),
        },
      });
    }
    return { updated: 0, skipped: interventions.length };
  }

  const byContent = new Map<string, number>();
  for (const row of rows) {
    const key = row.content.trim();
    if (!key || key === '(not set)') continue;
    byContent.set(key, (byContent.get(key) ?? 0) + row.sessions);
  }

  let updated = 0;
  let skipped = 0;
  const now = new Date();

  for (const iv of interventions) {
    const sessions = byContent.get(iv.attributionId);
    if (sessions == null) {
      await prisma.growthInterventionMetric.create({
        data: {
          workspaceId,
          interventionId: iv.id,
          kind: 'ga4_sessions',
          value: null,
          valueKnown: false,
          source: 'ga4',
          capturedAt: now,
          notes: 'Sin filas GA4 para este attributionId',
          provenance: 'fetchGa4SessionsByCampaignContent',
        },
      });
      skipped += 1;
      continue;
    }

    await prisma.growthInterventionMetric.create({
      data: {
        workspaceId,
        interventionId: iv.id,
        kind: 'ga4_sessions',
        value: sessions,
        valueKnown: true,
        source: 'ga4',
        capturedAt: now,
        notes: null,
        provenance: 'fetchGa4SessionsByCampaignContent',
      },
    });
    updated += 1;
  }

  return { updated, skipped };
}

export async function registerManualMetric(
  input: RegisterManualMetricInput,
): Promise<{ id: string }> {
  const intervention = await prisma.growthIntervention.findFirst({
    where: { id: input.interventionId, workspaceId: input.workspaceId },
  });
  if (!intervention) throw new Error('Intervention no encontrada');

  const row = await prisma.growthInterventionMetric.create({
    data: {
      workspaceId: input.workspaceId,
      interventionId: input.interventionId,
      kind: input.kind,
      value: input.value,
      valueKnown: true,
      source: 'manual',
      capturedAt: input.capturedAt ?? new Date(),
      notes: input.notes ?? null,
      provenance: input.registeredByHint ?? 'manual',
    },
  });
  return { id: row.id };
}

export type RunSynthesis = {
  runId: string;
  status: string;
  queryCount: number;
  serpHitCount: number;
  verifiedCount: number;
  opportunityCount: number;
  draftReadyCount: number;
  approvedCount: number;
  interventionCount: number;
  costUsd: number | null;
  costIsEstimate: boolean;
  topicInsight: Prisma.JsonValue | null;
  discardMotives: string[];
};

export async function buildRunSynthesis(runId: string): Promise<RunSynthesis | null> {
  const run = await prisma.growthConversationRun.findUnique({
    where: { id: runId },
    include: {
      opportunities: {
        include: {
          drafts: { select: { id: true, status: true } },
          interventions: { select: { id: true } },
        },
      },
      topicInsights: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!run) return null;

  const draftReadyCount = run.opportunities.filter((o) => o.editorialStatus === 'draft_ready')
    .length;
  const approvedCount = run.opportunities.filter((o) => o.editorialStatus === 'approved').length;
  const interventionCount = run.opportunities.reduce(
    (acc, o) => acc + o.interventions.length,
    0,
  );

  const summary = run.topicInsights[0]?.summary as
    | { discardMotives?: string[] }
    | null
    | undefined;

  return {
    runId: run.id,
    status: run.status,
    queryCount: run.queryCount,
    serpHitCount: run.serpHitCount,
    verifiedCount: run.verifiedCount,
    opportunityCount: run.opportunityCount,
    draftReadyCount,
    approvedCount,
    interventionCount,
    costUsd: run.costUsd,
    costIsEstimate: run.costIsEstimate,
    topicInsight: (run.topicInsights[0]?.summary as Prisma.JsonValue) ?? null,
    discardMotives: summary?.discardMotives ?? [],
  };
}
