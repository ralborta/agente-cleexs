/**
 * Sprint 1.3 — preguntas por cluster. Teo las genera solo; el backoffice solo las muestra.
 */
import type { KeywordQuestionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { expandClusterQuestions } from './question-cloud';

const MAX_OPEN_QUESTIONS = 120;
const REGEN_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const CLUSTERS_PER_TICK = 4;

export async function listKeywordQuestions(workspaceId: string, filters?: {
  status?: KeywordQuestionStatus;
  cluster?: string;
}) {
  const where: Prisma.KeywordQuestionWhereInput = {
    workspaceId,
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.cluster ? { cluster: filters.cluster } : {}),
  };

  const questions = await prisma.keywordQuestion.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { businessFit: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  });

  const byCluster: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const q of questions) {
    byCluster[q.cluster] = (byCluster[q.cluster] ?? 0) + 1;
    byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
  }

  return {
    questions,
    questionsSummary: {
      total: questions.length,
      byCluster,
      byStatus,
    },
  };
}

export async function updateKeywordQuestion(
  workspaceId: string,
  id: string,
  data: { status?: KeywordQuestionStatus; priority?: number; notes?: string | null },
) {
  const existing = await prisma.keywordQuestion.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error('Pregunta no encontrada');
  return prisma.keywordQuestion.update({ where: { id }, data });
}

/** Genera preguntas para los clusters top del workspace (autónomo). */
export async function generateQuestionsForWorkspace(
  workspaceId: string,
  opts?: { force?: boolean },
): Promise<{
  created: number;
  clusters: number;
  source: string;
  skipped: boolean;
  reason?: string;
}> {
  const force = opts?.force === true;
  const openCount = await prisma.keywordQuestion.count({
    where: { workspaceId, status: { in: ['idea', 'queued', 'in_progress'] } },
  });
  if (openCount >= MAX_OPEN_QUESTIONS) {
    return { created: 0, clusters: 0, source: 'none', skipped: true, reason: 'cap' };
  }

  if (!force) {
    const recent = await prisma.keywordQuestion.findFirst({
      where: {
        workspaceId,
        createdAt: { gte: new Date(Date.now() - REGEN_EVERY_MS) },
      },
      select: { id: true },
    });
    // Si ya hay preguntas frescas y suficientes abiertas, no regenerar.
    if (recent && openCount >= 40) {
      return { created: 0, clusters: 0, source: 'none', skipped: true, reason: 'fresh' };
    }
  }

  const ops = await prisma.keywordOpportunity.findMany({
    where: { workspaceId, status: { in: ['idea', 'queued', 'in_progress'] } },
    orderBy: [{ priority: 'desc' }, { demandScore: 'desc' }],
    take: 80,
    select: { cluster: true, keyword: true, priority: true },
  });

  if (!ops.length) {
    return { created: 0, clusters: 0, source: 'none', skipped: true, reason: 'no_opportunities' };
  }

  const byCluster = new Map<string, { priority: number; keywords: string[] }>();
  for (const op of ops) {
    const cur = byCluster.get(op.cluster) ?? { priority: 0, keywords: [] };
    cur.priority = Math.max(cur.priority, op.priority);
    if (cur.keywords.length < 8) cur.keywords.push(op.keyword);
    byCluster.set(op.cluster, cur);
  }

  const topClusters = [...byCluster.entries()]
    .sort((a, b) => b[1].priority - a[1].priority)
    .slice(0, CLUSTERS_PER_TICK);

  let created = 0;
  let source: 'llm' | 'rules' | 'mixed' = 'rules';
  const sources = new Set<string>();

  for (const [cluster, meta] of topClusters) {
    const { items, source: src } = await expandClusterQuestions(cluster, meta.keywords);
    sources.add(src);
    for (const item of items) {
      try {
        await prisma.keywordQuestion.create({
          data: {
            workspaceId,
            cluster: item.cluster,
            question: item.question,
            stage: item.stage,
            intent: item.intent,
            intentLabel: item.intentLabel,
            businessFit: item.businessFit,
            priority: item.priority,
            status: 'idea',
            source: src,
          },
        });
        created += 1;
      } catch {
        // unique
      }
    }
  }

  if (sources.size > 1) source = 'mixed';
  else if (sources.has('llm')) source = 'llm';

  return { created, clusters: topClusters.length, source, skipped: false };
}

export async function pickNextQuestion(workspaceId: string): Promise<{
  questionId: string;
  question: string;
  cluster: string;
  stage: string;
  businessFit: number;
} | null> {
  const queued = await prisma.keywordQuestion.findFirst({
    where: { workspaceId, status: 'queued' },
    orderBy: [{ priority: 'desc' }, { businessFit: 'desc' }],
  });
  if (queued) {
    return {
      questionId: queued.id,
      question: queued.question,
      cluster: queued.cluster,
      stage: queued.stage,
      businessFit: queued.businessFit,
    };
  }

  const idea = await prisma.keywordQuestion.findFirst({
    where: { workspaceId, status: 'idea', businessFit: { gte: 55 } },
    orderBy: [{ priority: 'desc' }, { businessFit: 'desc' }],
  });
  if (!idea) return null;
  return {
    questionId: idea.id,
    question: idea.question,
    cluster: idea.cluster,
    stage: idea.stage,
    businessFit: idea.businessFit,
  };
}

export async function markQuestionInProgress(workspaceId: string, questionId: string) {
  await prisma.keywordQuestion.updateMany({
    where: { id: questionId, workspaceId },
    data: { status: 'in_progress' },
  });
}

export async function markQuestionCovered(workspaceId: string, questionId: string) {
  await prisma.keywordQuestion.updateMany({
    where: { id: questionId, workspaceId },
    data: { status: 'covered' },
  });
}

export async function releaseQuestion(workspaceId: string, questionId: string) {
  await prisma.keywordQuestion.updateMany({
    where: { id: questionId, workspaceId, status: 'in_progress' },
    data: { status: 'idea' },
  });
}

/** Tick autónomo: genera preguntas en workspaces con Teo. */
export async function tickQuestionCloud(): Promise<{
  workspaces: number;
  created: number;
}> {
  const workspaces = await prisma.workspace.findMany({
    where: { agentConfigs: { some: { agent: { slug: 'teo' } } } },
    select: { id: true, slug: true },
  });

  let created = 0;
  let touched = 0;

  for (const ws of workspaces) {
    const result = await generateQuestionsForWorkspace(ws.id);
    if (result.skipped && result.created === 0) continue;
    touched += 1;
    created += result.created;
    if (result.created > 0) {
      console.log(
        `[question-cloud] ${ws.slug}: +${result.created} preguntas (${result.clusters} clusters, ${result.source})`,
      );
    }
  }

  return { workspaces: touched, created };
}
