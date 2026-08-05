/**
 * Sprint 1.2 — demanda real vía GSC (sin API paga).
 * Teo corre esto solo: importa queries, matchea oportunidades, recalcula priority.
 */
import { prisma } from '../../prisma';
import { fetchGscQueryMetrics } from '../../integrations/google-gsc';
import {
  isGoogleMetricsConfigured,
  resolveGoogleMetricsConfig,
} from '../../integrations/google-config';
import { normalizeKeyword } from './keyword-cloud';
import type { FunnelStage } from '@prisma/client';

type QuerySignal = {
  query: string;
  impressions: number;
  clicks: number;
};

function guessStage(query: string): FunnelStage {
  const q = query.toLowerCase();
  if (/precio|costo|contratar|agencia|comprar|vs\b|alternativa|mejor\b/.test(q)) return 'bofu';
  if (/cómo|checklist|mejorar|errores|guía|compar/.test(q)) return 'mofu';
  return 'tofu';
}

function stageBoost(stage: FunnelStage): number {
  if (stage === 'bofu') return 25;
  if (stage === 'mofu') return 15;
  return 5;
}

function titleCase(value: string): string {
  const t = value.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Match laxo: igualdad, inclusión, o tokens compartidos. */
export function matchQueryToKeyword(query: string, keyword: string): number {
  const q = normalizeKeyword(query);
  const k = normalizeKeyword(keyword);
  if (!q || !k) return 0;
  if (q === k) return 1;
  if (q.includes(k) || k.includes(q)) return 0.85;

  const qTokens = new Set(q.split(/\s+/).filter((t) => t.length > 2));
  const kTokens = k.split(/\s+/).filter((t) => t.length > 2);
  if (!kTokens.length) return 0;
  const hit = kTokens.filter((t) => qTokens.has(t)).length;
  const ratio = hit / kTokens.length;
  return ratio >= 0.6 ? ratio * 0.7 : 0;
}

function computeDemandScore(impressions: number, clicks: number): number {
  // Escala log: 0 imp → 0; 1000+ imp → ~70; clicks suman bonus
  const impScore = Math.min(70, Math.round(Math.log10(impressions + 1) * 28));
  const clickBonus = Math.min(25, clicks * 3);
  const zeroClickBonus = impressions >= 20 && clicks === 0 ? 15 : 0;
  return Math.min(100, impScore + clickBonus + zeroClickBonus);
}

function buildScoreReason(input: {
  impressions: number;
  clicks: number;
  demandScore: number;
  covered: boolean;
  stage: FunnelStage;
  matchedQuery?: string;
}): string {
  const parts: string[] = [];
  if (input.matchedQuery) {
    parts.push(`GSC: "${input.matchedQuery}" (${input.impressions} imp / ${input.clicks} clic)`);
  } else {
    parts.push('Sin match GSC aún — score por etapa/gap');
  }
  parts.push(`demanda ${input.demandScore}`);
  parts.push(input.covered ? 'ya hay pieza' : 'gap de cobertura');
  parts.push(`etapa ${input.stage.toUpperCase()}`);
  return parts.join(' · ');
}

/**
 * Importa top queries de GSC como oportunidades nuevas (si no existen)
 * y recalcula demandScore + priority de todas las abiertas.
 */
export async function scoreWorkspaceDemand(workspaceSlug: string): Promise<{
  scored: number;
  imported: number;
  skipped: boolean;
  reason?: string;
}> {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return { scored: 0, imported: 0, skipped: true, reason: 'workspace' };

  const config = resolveGoogleMetricsConfig(workspaceSlug);
  if (!isGoogleMetricsConfigured(config)) {
    return { scored: 0, imported: 0, skipped: true, reason: 'gsc_not_configured' };
  }

  let queries: QuerySignal[] = [];
  try {
    const rows = await fetchGscQueryMetrics(config, { days: 28, rowLimit: 500 });
    queries = rows.map((r) => ({
      query: r.query,
      impressions: r.impressions,
      clicks: r.clicks,
    }));
  } catch (err) {
    console.warn(
      `[demand-score] GSC queries falló (${workspaceSlug}):`,
      err instanceof Error ? err.message : err,
    );
    return { scored: 0, imported: 0, skipped: true, reason: 'gsc_error' };
  }

  // Piezas existentes → gap de cobertura
  const pieces = await prisma.contentPiece.findMany({
    where: { workspaceId: workspace.id, status: { notIn: ['archived'] } },
    select: { keyword: true, title: true, status: true },
  });

  function isCovered(keyword: string): boolean {
    return pieces.some(
      (p) =>
        matchQueryToKeyword(keyword, p.keyword ?? '') >= 0.7 ||
        matchQueryToKeyword(keyword, p.title) >= 0.7,
    );
  }

  // Importar top queries con señal real (autónomo: Teo descubre demanda)
  let imported = 0;
  const topForImport = [...queries]
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 40);

  for (const row of topForImport) {
    if (row.impressions < 5) continue;
    const keyword = titleCase(row.query);
    const stage = guessStage(row.query);
    const demandScore = computeDemandScore(row.impressions, row.clicks);
    const covered = isCovered(keyword);
    const priority = Math.min(
      100,
      demandScore + stageBoost(stage) + (covered ? -20 : 20),
    );

    try {
      await prisma.keywordOpportunity.create({
        data: {
          workspaceId: workspace.id,
          seedKeyword: 'GSC · demanda real',
          keyword,
          cluster: 'Demanda GSC',
          stage,
          intent: stage === 'bofu' ? 'transactional' : stage === 'mofu' ? 'commercial' : 'informational',
          intentLabel: 'Query real en Google Search Console',
          status: covered ? 'covered' : 'idea',
          priority: Math.max(0, priority),
          source: 'gsc_query',
          gscImpressions: row.impressions,
          gscClicks: row.clicks,
          demandScore,
          scoreReason: buildScoreReason({
            impressions: row.impressions,
            clicks: row.clicks,
            demandScore,
            covered,
            stage,
            matchedQuery: row.query,
          }),
          scoredAt: new Date(),
        },
      });
      imported += 1;
    } catch {
      // unique — ya existe
    }
  }

  // Rescore oportunidades abiertas
  const open = await prisma.keywordOpportunity.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: ['idea', 'queued', 'in_progress'] },
    },
  });

  let scored = 0;
  for (const op of open) {
    let best: { signal: QuerySignal; strength: number } | null = null;
    for (const q of queries) {
      const strength = matchQueryToKeyword(q.query, op.keyword);
      if (strength <= 0) continue;
      if (!best || strength > best.strength || (strength === best.strength && q.impressions > best.signal.impressions)) {
        best = { signal: q, strength };
      }
    }

    const impressions = best ? Math.round(best.signal.impressions * best.strength) : 0;
    const clicks = best ? Math.round(best.signal.clicks * best.strength) : 0;
    const demandScore = best ? computeDemandScore(impressions, clicks) : Math.min(30, op.priority);
    const covered = isCovered(op.keyword);
    // Base: conservar un poco del priority original (etapa LLM), sumar demanda y gap
    const base = Math.min(40, op.priority);
    const priority = Math.max(
      0,
      Math.min(100, Math.round(base * 0.35 + demandScore * 0.55 + stageBoost(op.stage) + (covered ? -15 : 18))),
    );

    await prisma.keywordOpportunity.update({
      where: { id: op.id },
      data: {
        gscImpressions: impressions || null,
        gscClicks: clicks || null,
        demandScore,
        priority,
        scoreReason: buildScoreReason({
          impressions,
          clicks,
          demandScore,
          covered,
          stage: op.stage,
          matchedQuery: best?.signal.query,
        }),
        scoredAt: new Date(),
        ...(covered && op.status === 'idea' ? { status: 'covered' } : {}),
      },
    });
    scored += 1;
  }

  return { scored, imported, skipped: false };
}

/** Tick autónomo: scorea demanda en todos los workspaces con Teo. */
export async function tickDemandScoring(): Promise<{
  workspaces: number;
  scored: number;
  imported: number;
}> {
  const workspaces = await prisma.workspace.findMany({
    where: { agentConfigs: { some: { agent: { slug: 'teo' } } } },
    select: { slug: true },
  });

  let scored = 0;
  let imported = 0;
  let touched = 0;

  for (const ws of workspaces) {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: ws.slug },
      select: { id: true },
    });
    if (!workspace) continue;

    // No martillar GSC: re-score como máximo cada 12h por workspace.
    const recent = await prisma.keywordOpportunity.findFirst({
      where: {
        workspaceId: workspace.id,
        scoredAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) continue;

    const result = await scoreWorkspaceDemand(ws.slug);
    if (result.skipped) continue;
    touched += 1;
    scored += result.scored;
    imported += result.imported;
    if (result.imported > 0 || result.scored > 0) {
      console.log(
        `[demand-score] ${ws.slug}: scored=${result.scored} imported=${result.imported}`,
      );
    }
  }

  return { workspaces: touched, scored, imported };
}
