import { prisma } from '../../prisma';
import {
  fetchKeywordSuggestions,
  fetchKeywordsForKeywords,
  fetchKeywordsForSite,
  fetchRelatedKeywords,
  isDataForSeoConfigured,
  resolveDataForSeoConfig,
  type DataForSeoKeywordRow,
} from '../../integrations/dataforseo';
import { logAgentActivity } from '../../agent-helpers';
import { enrichCandidatesWithLlm } from './enrich-llm';
import { scoreDemandFromVolume, scoreTrendFromMonthly } from './score';
import {
  DISCOVERY_MARKETS,
  type DiscoveryExploreInput,
  type DiscoveryKeywordCandidate,
  type DiscoverySettings,
  type OpportunityBrief,
} from './types';
import { enrichBriefsWithYoutube } from './youtube-enrich';

function normalizeKeyword(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function titleCaseKeyword(value: string): string {
  const t = value.replace(/\s+/g, ' ').trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const STOP = new Set([
  'para', 'con', 'como', 'que', 'qué', 'una', 'uno', 'los', 'las', 'del', 'por',
  'the', 'and', 'for', 'with', 'from', 'tools', 'tool', 'best', 'mejor', 'mejores',
]);

function tokenize(...parts: string[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    const norm = part
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const t of norm.split(/[^a-z0-9]+/)) {
      if (t.length >= 3 && !STOP.has(t)) out.add(t);
    }
  }
  return out;
}

function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Descarta ideas sin overlap con semillas/negocio (evita basura tipo Seotools). */
function overlapsBusiness(
  keyword: string,
  seeds: string[],
  description: string,
): boolean {
  const normKw = stripDiacritics(keyword);
  for (const seed of seeds) {
    const s = stripDiacritics(seed).replace(/\s+/g, ' ').trim();
    if (s.length >= 4 && normKw.includes(s)) return true;
  }
  const business = tokenize(...seeds, description);
  if (!business.size) return true;
  const kw = tokenize(keyword);
  for (const t of kw) {
    if (business.has(t)) return true;
  }
  return false;
}

function resolveMarket(input: DiscoveryExploreInput) {
  const key = (input.market ?? 'ar').toLowerCase();
  const market = DISCOVERY_MARKETS[key] ?? DISCOVERY_MARKETS.ar;
  return {
    ...market,
    languageCode: input.languageCode?.trim() || market.languageCode,
  };
}

function rowToCandidate(
  row: DataForSeoKeywordRow,
  seedKeyword: string,
  source: DiscoveryKeywordCandidate['source'],
): DiscoveryKeywordCandidate | null {
  const keyword = normalizeKeyword(row.keyword ?? '');
  if (keyword.length < 2) return null;

  const monthlySearches =
    typeof row.search_volume === 'number' && Number.isFinite(row.search_volume)
      ? row.search_volume
      : null;
  const trend = scoreTrendFromMonthly(row.monthly_searches);
  const demandScore = scoreDemandFromVolume(monthlySearches);

  return {
    keyword: titleCaseKeyword(keyword),
    seedKeyword,
    monthlySearches,
    competitionIndex:
      typeof row.competition_index === 'number' ? row.competition_index : null,
    demandScore,
    trendScore: trend.score,
    trendLabel: trend.label,
    source,
  };
}

function mergeCandidates(
  existing: Map<string, DiscoveryKeywordCandidate>,
  incoming: DiscoveryKeywordCandidate[],
) {
  for (const c of incoming) {
    const key = normalizeKeyword(c.keyword);
    const prev = existing.get(key);
    if (!prev) {
      existing.set(key, c);
      continue;
    }
    // Prefer higher volume / richer trend
    if ((c.monthlySearches ?? 0) > (prev.monthlySearches ?? 0)) {
      existing.set(key, { ...c, seedKeyword: prev.seedKeyword || c.seedKeyword });
    }
  }
}

async function ensureDiscoveryAgent(workspaceId: string) {
  const agent = await prisma.agent.upsert({
    where: { slug: 'discovery' },
    update: {},
    create: {
      slug: 'discovery',
      name: 'Discovery',
      description:
        'Agente de descubrimiento de demanda — keywords, tendencia y opportunity briefs para Teo',
    },
  });

  await prisma.agentConfig.upsert({
    where: {
      workspaceId_agentId: { workspaceId, agentId: agent.id },
    },
    update: {},
    create: {
      workspaceId,
      agentId: agent.id,
      frequency: 'on-demand',
      autoPublish: false,
      topics: [],
      settings: {},
    },
  });

  return agent;
}

async function persistBriefs(
  workspaceId: string,
  briefs: OpportunityBrief[],
  seedFallback: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const brief of briefs) {
    const keyword = titleCaseKeyword(brief.primaryQuery);
    const existing = await prisma.keywordOpportunity.findUnique({
      where: {
        workspaceId_keyword: { workspaceId, keyword },
      },
    });

    const data = {
      seedKeyword: seedFallback,
      cluster: brief.cluster,
      stage: brief.stage,
      intent: brief.intent,
      intentLabel: brief.intentLabel,
      priority: brief.opportunityScore,
      source: `discovery_dataforseo_${brief.providerMode}`,
      status: existing?.status === 'covered' || existing?.status === 'discarded'
        ? existing.status
        : existing?.status ?? 'idea',
      demandScore: brief.demandScore,
      monthlySearches: brief.monthlySearches,
      trendScore: brief.trendScore,
      relevanceScore: brief.relevanceScore,
      opportunityScore: brief.opportunityScore,
      scoreReason: `Discovery: demanda ${brief.demandScore} · tendencia ${brief.trendScore} · relevancia ${brief.relevanceScore} → ${brief.opportunityScore}`,
      scoredAt: new Date(),
      brief: brief as object,
      notes: [
        brief.suggestedAngle,
        `Contenido: ${brief.recommendedContent}`,
        `Target: ${brief.target}`,
        brief.relatedQueries.length
          ? `Related: ${brief.relatedQueries.join(' · ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    };

    if (existing) {
      await prisma.keywordOpportunity.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.keywordOpportunity.create({
        data: {
          workspaceId,
          keyword,
          ...data,
        },
      });
      created += 1;
    }
  }

  return { created, updated };
}

export async function runDiscoveryExplore(
  workspaceSlug: string,
  input: DiscoveryExploreInput,
): Promise<{
  ok: true;
  mode: 'sandbox' | 'live';
  cost: number;
  pool: number;
  candidates: number;
  briefs: number;
  youtubeEnriched: number;
  created: number;
  updated: number;
  top: OpportunityBrief[];
}> {
  const config = resolveDataForSeoConfig();
  if (!config || !isDataForSeoConfigured()) {
    throw new Error(
      'DataForSEO no configurado. Definí DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD (modo sandbox por defecto).',
    );
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const seeds = [
    ...new Set(
      input.seeds
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length >= 2 && s.length <= 80),
    ),
  ].slice(0, 20);

  if (!seeds.length) throw new Error('Agregá al menos una keyword semilla');

  const siteUrl = input.siteUrl.trim() || `https://${workspaceSlug}.net`;
  const description = input.description.trim() || workspace.name;
  const market = resolveMarket(input);
  const maxCandidates = Math.min(120, Math.max(10, input.maxCandidates ?? 80));
  const deepExpand = input.deepExpand !== false;
  const includeYoutube = input.includeYoutube !== false;
  const youtubeMaxKeywords = Math.min(20, Math.max(0, input.youtubeMaxKeywords ?? 10));

  const agent = await ensureDiscoveryAgent(workspace.id);

  await logAgentActivity({
    workspaceId: workspace.id,
    agentId: agent.id,
    role: 'strategist',
    message: `Discovery explorando demanda (${config.mode}): ${seeds.length} semillas · ${market.label}${deepExpand ? ' · expansión Labs' : ''}${includeYoutube ? ` · YouTube top ${youtubeMaxKeywords}` : ''}`,
  });

  const merged = new Map<string, DiscoveryKeywordCandidate>();
  let totalCost = 0;

  // 1) Google Ads Keyword Planner — hasta 20 seeds en un request
  for (let i = 0; i < seeds.length; i += 20) {
    const batch = seeds.slice(i, i + 20);
    const { rows, cost } = await fetchKeywordsForKeywords(config, {
      keywords: batch,
      locationCode: market.locationCode,
      languageCode: market.languageCode,
      sortBy: 'search_volume',
    });
    totalCost += cost;
    const seedTag = batch[0] ?? 'seed';
    mergeCandidates(
      merged,
      rows
        .map((row) => rowToCandidate(row, seedTag, 'keywords_for_keywords'))
        .filter((c): c is DiscoveryKeywordCandidate => Boolean(c)),
    );
  }

  // 2) Labs related + suggestions — muchas más keywords (SERP / long-tail)
  if (deepExpand) {
    const relatedSeeds = seeds.slice(0, 8);
    for (const seed of relatedSeeds) {
      try {
        const { rows, cost } = await fetchRelatedKeywords(config, {
          keyword: seed,
          locationCode: market.locationCode,
          languageCode: market.languageCode,
          depth: 2,
          limit: 100,
        });
        totalCost += cost;
        mergeCandidates(
          merged,
          rows
            .map((row) => rowToCandidate(row, seed, 'related_keywords'))
            .filter((c): c is DiscoveryKeywordCandidate => Boolean(c)),
        );
      } catch (err) {
        console.warn(
          '[discovery] related_keywords falló:',
          seed,
          err instanceof Error ? err.message : err,
        );
      }
    }

    const suggestSeeds = seeds.slice(0, 5);
    for (const seed of suggestSeeds) {
      try {
        const { rows, cost } = await fetchKeywordSuggestions(config, {
          keyword: seed,
          locationCode: market.locationCode,
          languageCode: market.languageCode,
          limit: 80,
        });
        totalCost += cost;
        mergeCandidates(
          merged,
          rows
            .map((row) => rowToCandidate(row, seed, 'keyword_suggestions'))
            .filter((c): c is DiscoveryKeywordCandidate => Boolean(c)),
        );
      } catch (err) {
        console.warn(
          '[discovery] keyword_suggestions falló:',
          seed,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  if (input.includeSiteKeywords === true && siteUrl) {
    try {
      const { rows, cost } = await fetchKeywordsForSite(config, {
        target: siteUrl,
        locationCode: market.locationCode,
        languageCode: market.languageCode,
      });
      totalCost += cost;
      mergeCandidates(
        merged,
        rows
          .map((row) => rowToCandidate(row, seeds[0] ?? siteUrl, 'keywords_for_site'))
          .filter((c): c is DiscoveryKeywordCandidate => Boolean(c)),
      );
    } catch (err) {
      console.warn(
        '[discovery] keywords_for_site falló:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const rawPool = merged.size;
  const ranked = [...merged.values()]
    .filter((c) => overlapsBusiness(c.keyword, seeds, description))
    .sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0) || b.demandScore - a.demandScore)
    .slice(0, maxCandidates);

  if (!ranked.length) {
    throw new Error(
      `DataForSEO trajo ${rawPool} keywords crudas pero ninguna alineada a semillas/negocio. Probá semillas más concretas o relajá la descripción.`,
    );
  }

  const briefs = await enrichCandidatesWithLlm(ranked, {
    siteUrl,
    description,
    marketLabel: market.label,
    providerMode: config.mode,
  });

  // Descartar relevancia baja; en live exigimos más alineación al negocio
  const minRelevance = config.mode === 'live' ? 50 : 35;
  let kept = briefs
    .filter((b) => b.relevanceScore >= minRelevance)
    .filter((b) => overlapsBusiness(b.primaryQuery, seeds, description))
    .slice(0, maxCandidates);

  let youtubeEnriched = 0;
  if (includeYoutube && kept.length && youtubeMaxKeywords > 0) {
    try {
      const yt = await enrichBriefsWithYoutube(
        config,
        kept,
        market,
        youtubeMaxKeywords,
      );
      kept = yt.briefs;
      totalCost += yt.cost;
      youtubeEnriched = yt.enriched;
    } catch (err) {
      console.warn(
        '[discovery] youtube enrich falló:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const { created, updated } = await persistBriefs(workspace.id, kept, seeds[0] ?? 'seed');

  const settings: DiscoverySettings = {
    siteUrl,
    description,
    market: input.market ?? 'ar',
    languageCode: market.languageCode,
    seeds,
    includeYoutube,
  };

  await prisma.agentConfig.updateMany({
    where: { workspaceId: workspace.id, agentId: agent.id },
    data: {
      topics: seeds,
      settings: settings as object,
    },
  });

  await logAgentActivity({
    workspaceId: workspace.id,
    agentId: agent.id,
    role: 'strategist',
    level: 'success',
    message: `Discovery OK (${config.mode}): pool ${rawPool} → ${ranked.length} candidatos → ${kept.length} briefs${youtubeEnriched ? ` · YT ${youtubeEnriched}` : ''} · +${created}/~${updated} · cost≈$${totalCost.toFixed(4)}`,
  });

  return {
    ok: true,
    mode: config.mode,
    cost: totalCost,
    pool: rawPool,
    candidates: ranked.length,
    briefs: kept.length,
    youtubeEnriched,
    created,
    updated,
    top: kept.slice(0, 10),
  };
}

export function getDiscoveryStatus() {
  const config = resolveDataForSeoConfig();
  return {
    configured: Boolean(config),
    mode: config?.mode ?? 'sandbox',
    provider: 'dataforseo' as const,
  };
}
