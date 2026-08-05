import { prisma } from '../../prisma';
import type { StrategistPlan } from './types';
import {
  markOpportunityInProgress,
  pickNextOpportunityTopic,
} from './keyword-opportunities';
import {
  markQuestionInProgress,
  pickNextQuestion,
} from './keyword-questions';

const ECOSYSTEM_TYPES = ['pillar', 'faq', 'checklist', 'comparison', 'how_to'] as const;

type TeoConfigInput = {
  topics?: string[] | null;
};

export type StrategicHints = Partial<StrategistPlan> & {
  rationale?: string;
  opportunityId?: string;
  questionId?: string;
};

function normalizeTopic(value: string): string {
  return value.trim().toLowerCase();
}

function topicMatches(pieceTopic: string | null | undefined, topic: string): boolean {
  if (!pieceTopic) return false;
  const needle = normalizeTopic(topic);
  const hay = normalizeTopic(pieceTopic);
  return hay.includes(needle) || needle.includes(hay);
}

function pickPieceType(
  topic: string,
  existingTypes: Set<string>,
  metricsSignal: 'low_visibility' | 'zero_clicks' | 'coverage_gap',
): StrategistPlan['pieceType'] {
  const missing = ECOSYSTEM_TYPES.filter((t) => !existingTypes.has(t));

  if (metricsSignal === 'zero_clicks') {
    if (!existingTypes.has('comparison')) return 'comparison';
    if (!existingTypes.has('how_to')) return 'how_to';
    return 'checklist';
  }

  if (metricsSignal === 'low_visibility') {
    if (!existingTypes.has('faq')) return 'faq';
    if (!existingTypes.has('pillar')) return 'pillar';
  }

  if (missing.includes('pillar') && !existingTypes.has('pillar')) return 'pillar';
  if (missing.includes('faq')) return 'faq';
  if (missing.includes('checklist')) return 'checklist';
  if (missing.includes('comparison')) return 'comparison';
  if (missing.includes('how_to')) return 'how_to';

  return ECOSYSTEM_TYPES[existingTypes.size % ECOSYSTEM_TYPES.length];
}

export function buildTitle(pieceType: string, topic: string): string {
  switch (pieceType) {
    case 'faq':
      return `FAQ: ${topic}`;
    case 'comparison':
      return `Comparativa: ${topic}`;
    case 'checklist':
      return `Checklist: ${topic}`;
    case 'how_to':
      return `Cómo mejorar ${topic}`;
    case 'pillar':
      // Evita "…para PyMEs para PyMEs" cuando el tema ya menciona el público.
      return /pyme/i.test(topic) ? `Guía PRO: ${topic}` : `Guía PRO: ${topic} para PyMEs`;
    default:
      return `Artículo: ${topic}`;
  }
}

/**
 * Prioriza: 1) oportunidades de keyword en cola, 2) cobertura + métricas GSC, 3) rotación de topics.
 */
export async function getStrategicPlanHints(
  workspaceSlug: string,
  config: TeoConfigInput,
  missionIndex: number,
): Promise<StrategicHints> {
  const topics =
    Array.isArray(config.topics) && config.topics.length > 0
      ? config.topics
      : ['visibilidad en IA', 'SEO', 'AEO'];

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    const topic = topics[missionIndex % topics.length];
    return { topic, pieceType: 'faq', keyword: topic, rationale: 'Workspace no encontrado — fallback' };
  }

  // Preferir oportunidades del Input Engine (encoladas o ideas priorizadas — Teo elige solo).
  const opportunity = await pickNextOpportunityTopic(workspace.id);
  if (opportunity) {
    const piecesForOp = await prisma.contentPiece.findMany({
      where: {
        workspaceId: workspace.id,
        status: { notIn: ['archived'] },
        OR: [
          { keyword: { contains: opportunity.keyword, mode: 'insensitive' } },
          { title: { contains: opportunity.keyword, mode: 'insensitive' } },
        ],
      },
      select: { type: true },
    });
    const existingTypes = new Set(piecesForOp.map((p) => p.type));

    // Si falta FAQ en el cluster y hay pregunta real priorizada → FAQ desde pregunta.
    const question = await pickNextQuestion(workspace.id);
    const wantsFaqFromQuestion =
      question &&
      question.cluster === opportunity.cluster &&
      !existingTypes.has('faq') &&
      question.businessFit >= 55;

    if (wantsFaqFromQuestion && question) {
      await markOpportunityInProgress(workspace.id, opportunity.opportunityId).catch(() => undefined);
      await markQuestionInProgress(workspace.id, question.questionId).catch(() => undefined);
      const topic =
        opportunity.cluster.replace(/^cluster:\s*/i, '').trim() || opportunity.topic;
      return {
        topic,
        pieceType: 'faq',
        title: question.question.replace(/^\¿/, 'FAQ: ').replace(/\?$/, '') || buildTitle('faq', topic),
        keyword: opportunity.keyword,
        depth: 'standard' as const,
        objective: `Responder la pregunta real "${question.question}" (cluster ${question.cluster}, etapa ${question.stage}). Incluir FAQPage-ready Q&A.`,
        rationale: `Pregunta priorizada (fit ${question.businessFit}) + oportunidad ${opportunity.stage}`,
        opportunityId: opportunity.opportunityId,
        questionId: question.questionId,
      };
    }

    const signal =
      opportunity.stage === 'bofu'
        ? ('zero_clicks' as const)
        : opportunity.stage === 'tofu'
          ? ('coverage_gap' as const)
          : ('low_visibility' as const);
    const pieceType = pickPieceType(opportunity.topic, existingTypes, signal);
    const depth = pieceType === 'pillar' ? ('pro' as const) : ('standard' as const);
    await markOpportunityInProgress(workspace.id, opportunity.opportunityId).catch(() => undefined);

    return {
      topic: opportunity.topic,
      pieceType,
      title: buildTitle(pieceType, opportunity.topic),
      keyword: opportunity.keyword,
      depth,
      objective: `Generar pieza tipo ${pieceType} sobre "${opportunity.topic}" desde oportunidad ${opportunity.stage.toUpperCase()} (cluster: ${opportunity.cluster}).`,
      rationale: `Oportunidad priorizada (${opportunity.stage}): ${opportunity.cluster}`,
      opportunityId: opportunity.opportunityId,
    };
  }

  // Sin keyword en cola: si hay pregunta fuerte, Teo escribe FAQ solo.
  const loneQuestion = await pickNextQuestion(workspace.id);
  if (loneQuestion) {
    await markQuestionInProgress(workspace.id, loneQuestion.questionId).catch(() => undefined);
    const topic = loneQuestion.cluster.replace(/^cluster:\s*/i, '').trim() || loneQuestion.question;
    return {
      topic,
      pieceType: 'faq',
      title: loneQuestion.question,
      keyword: topic,
      depth: 'standard' as const,
      objective: `Responder la pregunta real "${loneQuestion.question}" del cluster ${loneQuestion.cluster}.`,
      rationale: `Pregunta AnswerThePublic-like (fit ${loneQuestion.businessFit})`,
      questionId: loneQuestion.questionId,
    };
  }

  const [pieces, publications, gscMetrics, clusterPieces] = await Promise.all([
    prisma.contentPiece.findMany({
      where: {
        workspaceId: workspace.id,
        status: { notIn: ['archived'] },
      },
      select: { title: true, keyword: true, type: true, status: true },
    }),
    prisma.publication.findMany({
      where: { workspaceId: workspace.id },
      select: { url: true, piece: { select: { keyword: true, title: true } } },
    }),
    prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id, source: 'gsc' },
      orderBy: { capturedAt: 'desc' },
      take: 500,
      select: { url: true, impressions: true, clicks: true, capturedAt: true },
    }),
    prisma.contentPiece.findMany({
      where: {
        workspaceId: workspace.id,
        clusterId: { not: null },
        status: { not: 'archived' },
      },
      select: { type: true, keyword: true, title: true },
    }),
  ]);

  const latestMetricsByUrl = new Map<string, { impressions: number; clicks: number }>();
  for (const row of gscMetrics) {
    if (!latestMetricsByUrl.has(row.url)) {
      latestMetricsByUrl.set(row.url, {
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
      });
    }
  }

  type TopicScore = {
    topic: string;
    score: number;
    signal: 'low_visibility' | 'zero_clicks' | 'coverage_gap';
    rationale: string[];
  };

  const clusterTypes = new Set(clusterPieces.map((p) => p.type));
  const clusterMissing = ECOSYSTEM_TYPES.filter((t) => !clusterTypes.has(t));

  const scores: TopicScore[] = [];

  for (const topic of topics) {
    const topicPieces = pieces.filter(
      (p) => topicMatches(p.keyword, topic) || topicMatches(p.title, topic),
    );
    const publishedCount = topicPieces.filter((p) =>
      ['published', 'refresh_needed'].includes(p.status),
    ).length;
    const types = new Set(topicPieces.map((p) => p.type));

    let score = 0;
    const rationale: string[] = [];
    let signal: TopicScore['signal'] = 'coverage_gap';

    if (publishedCount === 0) {
      score += 60;
      rationale.push(`Sin piezas publicadas sobre "${topic}"`);
      signal = 'coverage_gap';
    } else if (publishedCount < 3) {
      score += 35;
      rationale.push(`Cobertura baja (${publishedCount} pieza(s)) en "${topic}"`);
    }

    const missingTypes = ECOSYSTEM_TYPES.filter((t) => !types.has(t));
    if (missingTypes.length > 0) {
      score += 20 + missingTypes.length * 5;
      rationale.push(`Faltan tipos: ${missingTypes.join(', ')}`);
    }

    for (const pub of publications) {
      if (!pub.url) continue;
      if (!topicMatches(pub.piece.keyword, topic) && !topicMatches(pub.piece.title, topic)) continue;

      const metrics = latestMetricsByUrl.get(pub.url);
      if (!metrics) continue;

      if (metrics.impressions >= 20 && metrics.clicks === 0) {
        score += 45 + Math.min(metrics.impressions, 40);
        signal = 'zero_clicks';
        rationale.push(
          `${metrics.impressions} impresiones sin clicks en Google — oportunidad de mejora`,
        );
      } else if (metrics.impressions === 0) {
        score += 25;
        if (signal !== 'zero_clicks') signal = 'low_visibility';
        rationale.push('Sin visibilidad en Google para URLs del tema');
      }
    }

    scores.push({ topic, score, signal, rationale });
  }

  scores.sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
  const winner = scores[0] ?? {
    topic: topics[missionIndex % topics.length],
    score: 0,
    signal: 'coverage_gap' as const,
    rationale: ['Plan por rotación de temas'],
  };

  const winnerPieces = pieces.filter(
    (p) => topicMatches(p.keyword, winner.topic) || topicMatches(p.title, winner.topic),
  );
  const existingTypes = new Set(winnerPieces.map((p) => p.type));
  for (const missing of clusterMissing) {
    if (!existingTypes.has(missing)) {
      existingTypes.add(missing);
    }
  }
  const pieceType = pickPieceType(winner.topic, existingTypes, winner.signal);
  const depth = pieceType === 'pillar' ? ('pro' as const) : ('standard' as const);
  const title = buildTitle(pieceType, winner.topic);

  const metricsNote =
    [
      ...winner.rationale,
      clusterMissing.length > 0 ? `Ecosistema: faltan tipos ${clusterMissing.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('. ') || 'Rotación de temas';

  return {
    topic: winner.topic,
    pieceType,
    title,
    keyword: winner.topic,
    depth,
    objective: `Generar pieza tipo ${pieceType} sobre "${winner.topic}" priorizada por métricas (${metricsNote}).`,
    rationale: metricsNote,
  };
}
