import type { GrowthScoreWeights } from './config';

export type VerifyLikeForScore = {
  verifyStatus: string;
  title?: string | null;
  topic?: string | null;
  questionText?: string | null;
  evidenceSnippet?: string | null;
  audienceFitNotes?: string | null;
  threadCreatedAtKnown?: boolean;
  lastActivityAtKnown?: boolean;
  threadCreatedAt?: Date | string | null;
  lastActivityAt?: Date | string | null;
  allowsReplies?: boolean | null;
  isClosed?: boolean | null;
  isArchived?: boolean | null;
  participationSignals?: unknown;
};

export type ScoreOpportunityInput = {
  verify: VerifyLikeForScore;
  articleKeyword?: string | null;
  articleTitle?: string | null;
  audienceHints?: string[];
  weights: GrowthScoreWeights;
};

export type ScoreBreakdown = {
  factors: {
    problemFit: number;
    audienceFit: number;
    recentActivity: number;
    usefulReply: number;
    canParticipate: number;
  };
  motives: string[];
};

export type ScoreOpportunityResult = {
  opportunityScore: number;
  evidenceConfidence: number;
  breakdown: ScoreBreakdown;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((t) => t.length >= 3);
}

function overlapRatio(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit += 1;
  return clamp01(hit / Math.max(3, Math.min(ta.size, 12)));
}

function daysSince(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
}

/** Aprobado editorial ≠ publicado en el foro (eso requiere GrowthIntervention). */
export function isEditoriallyApproved(editorialStatus: string): boolean {
  return editorialStatus === 'approved';
}

export function isConceptuallyPublished(hasIntervention: boolean): boolean {
  return hasIntervention === true;
}

/**
 * Separa opportunityScore (utilidad de intervenir) de evidenceConfidence
 * (qué tan confiables son las señales). Fechas desconocidas NO se inventan:
 * bajan confidence y se explican en motives.
 */
export function scoreOpportunity(input: ScoreOpportunityInput): ScoreOpportunityResult {
  const { verify, weights } = input;
  const motives: string[] = [];
  const haystack = [
    verify.title,
    verify.topic,
    verify.questionText,
    verify.evidenceSnippet,
  ]
    .filter(Boolean)
    .join(' ');

  const keyword = (input.articleKeyword ?? '').trim();
  const title = (input.articleTitle ?? '').trim();
  const problemFit = clamp01(
    Math.max(
      keyword ? overlapRatio(haystack, keyword) * 1.2 : 0,
      title ? overlapRatio(haystack, title) : 0,
      haystack ? 0.15 : 0,
    ),
  );
  if (problemFit < 0.25) motives.push('poca coincidencia temática con el artículo');

  const hints = (input.audienceHints ?? []).filter(Boolean);
  let audienceFit = 0.45;
  if (hints.length) {
    const note = `${verify.audienceFitNotes ?? ''} ${haystack}`;
    audienceFit = clamp01(
      Math.max(...hints.map((h) => overlapRatio(note, h)), 0.2),
    );
  } else if (verify.audienceFitNotes) {
    audienceFit = 0.55;
  }

  let recentActivity = 0.35;
  const createdKnown = Boolean(verify.threadCreatedAtKnown);
  const activityKnown = Boolean(verify.lastActivityAtKnown);
  if (!createdKnown && !activityKnown) {
    recentActivity = 0.25;
    motives.push('fechas de actividad desconocidas — no se asume frescura');
  } else {
    const ageDays =
      daysSince(activityKnown ? verify.lastActivityAt : null) ??
      daysSince(createdKnown ? verify.threadCreatedAt : null);
    if (ageDays == null) {
      recentActivity = 0.3;
      motives.push('fecha marcada conocida pero no parseable');
    } else if (ageDays <= 30) recentActivity = 0.95;
    else if (ageDays <= 90) recentActivity = 0.7;
    else if (ageDays <= 365) recentActivity = 0.4;
    else {
      recentActivity = 0.15;
      motives.push('hilo antiguo según fecha conocida');
    }
  }

  let usefulReply = 0.5;
  if (verify.questionText && verify.questionText.length > 40) usefulReply = 0.75;
  if (verify.evidenceSnippet && verify.evidenceSnippet.length > 80) {
    usefulReply = Math.max(usefulReply, 0.65);
  }
  if (verify.verifyStatus !== 'verified') {
    usefulReply = Math.min(usefulReply, 0.2);
    motives.push('página no verificada como conversación usable');
  }

  let canParticipate = 0.6;
  if (verify.isClosed === true || verify.isArchived === true) {
    canParticipate = 0.05;
    motives.push('hilo cerrado o archivado');
  } else if (verify.allowsReplies === false) {
    canParticipate = 0.1;
    motives.push('no permite respuestas');
  } else if (verify.allowsReplies === true) {
    canParticipate = 0.9;
  } else {
    canParticipate = 0.45;
    motives.push('permiso de respuesta desconocido');
  }

  const factors = {
    problemFit,
    audienceFit,
    recentActivity,
    usefulReply,
    canParticipate,
  };

  const opportunityScore = clamp01(
    factors.problemFit * weights.problemFit +
      factors.audienceFit * weights.audienceFit +
      factors.recentActivity * weights.recentActivity +
      factors.usefulReply * weights.usefulReply +
      factors.canParticipate * weights.canParticipate,
  );

  let evidenceConfidence = 0.55;
  if (verify.verifyStatus === 'verified') evidenceConfidence += 0.2;
  else evidenceConfidence -= 0.25;
  if (createdKnown || activityKnown) evidenceConfidence += 0.1;
  else evidenceConfidence -= 0.15;
  if (verify.allowsReplies == null) evidenceConfidence -= 0.05;
  if (!verify.evidenceSnippet) evidenceConfidence -= 0.1;
  evidenceConfidence = clamp01(evidenceConfidence);

  if (evidenceConfidence < 0.5) {
    motives.push('confianza de evidencia reducida por señales incompletas');
  }

  return {
    opportunityScore,
    evidenceConfidence,
    breakdown: { factors, motives },
  };
}
