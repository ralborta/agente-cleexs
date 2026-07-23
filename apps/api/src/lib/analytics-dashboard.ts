import { prisma } from './prisma';
import {
  AI_SOURCE_CATALOG,
  classifySessionSource,
  emptySourceTotals,
  type AiSourceId,
} from './integrations/ai-source-classifier';
import {
  fetchGa4BlogSessionTotals,
  fetchGa4DailySessions,
  fetchGa4DailySessionsBySource,
  fetchGa4PageSessions,
  fetchGa4SessionsBySource,
} from './integrations/google-ga4';
import { fetchGscAggregateMetrics, fetchGscPageMetrics } from './integrations/google-gsc';
import {
  getGoogleMetricsStatus,
  hasGa4Configured,
  isGoogleMetricsConfigured,
  resolveGoogleMetricsConfig,
} from './integrations/google-config';

export type AnalyticsPeriod = 7 | 30 | 90;

export type MetricWithTrend = {
  value: number;
  change: number | null;
  label: string;
};

export type AnalyticsDashboard = {
  workspace: { slug: string; name: string };
  period: AnalyticsPeriod;
  updatedAt: string;
  sources: {
    gsc: boolean;
    ga4: boolean;
  };
  kpis: {
    aiSessions: MetricWithTrend;
    totalSessions: MetricWithTrend;
    aiShare: MetricWithTrend;
    clicks: MetricWithTrend;
    impressions: MetricWithTrend;
    publications: MetricWithTrend;
  };
  dailySeries: Array<{
    date: string;
    label: string;
    total: number;
    ai: number;
    google: number;
    chatgpt: number;
    perplexity: number;
    claude: number;
  }>;
  aiSources: Array<{
    id: AiSourceId;
    label: string;
    color: string;
    sessions: number;
    change: number | null;
    share: number;
  }>;
  topArticles: Array<{
    title: string;
    slug: string | null;
    url: string | null;
    clicks: number;
    impressions: number;
    sessions: number;
  }>;
  recentPublications: Array<{
    id: string;
    title: string;
    slug: string | null;
    url: string | null;
    publishedAt: string | null;
  }>;
  insight: {
    newArticlesThisPeriod: number;
    message: string;
  };
};

const cache = new Map<string, { expires: number; data: AnalyticsDashboard }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function formatGa4Date(raw: string) {
  if (raw.length !== 8) return raw;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}T12:00:00`);
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function shortDayLabel(raw: string) {
  if (raw.length !== 8) return raw;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const date = new Date(`${y}-${m}-${d}T12:00:00`);
  return date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
}

function pathnameOf(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return url.replace(/\/$/, '');
  }
}

function buildLatestSnapshotByUrl(
  rows: Array<{
    url: string;
    clicks: number | null;
    impressions: number | null;
    sessions: number | null;
    capturedAt: Date;
  }>,
) {
  if (rows.length === 0) return {};

  const latestTs = rows[0].capturedAt.getTime();
  const batch = rows.filter((row) => Math.abs(row.capturedAt.getTime() - latestTs) < 5000);

  return batch.reduce<
    Record<string, { clicks: number; impressions: number; sessions: number }>
  >((acc, row) => {
    if (!acc[row.url]) {
      acc[row.url] = { clicks: 0, impressions: 0, sessions: 0 };
    }
    acc[row.url].clicks += row.clicks ?? 0;
    acc[row.url].impressions += row.impressions ?? 0;
    acc[row.url].sessions += row.sessions ?? 0;
    return acc;
  }, {});
}

function aggregateSources(rows: Array<{ source: string; medium: string; sessions: number }>) {
  const totals = emptySourceTotals();
  for (const row of rows) {
    const id = classifySessionSource(row.source, row.medium);
    totals[id] += row.sessions;
  }
  return totals;
}

function aiSessionsFromTotals(totals: Record<AiSourceId, number>) {
  return (
    totals.chatgpt +
    totals.perplexity +
    totals.claude +
    totals.copilot +
    totals.gemini
  );
}

function buildDailySeries(
  dailyTotals: Awaited<ReturnType<typeof fetchGa4DailySessions>>,
  dailyBySource: Awaited<ReturnType<typeof fetchGa4DailySessionsBySource>>,
) {
  const byDate = new Map<
    string,
    {
      total: number;
      ai: number;
      google: number;
      chatgpt: number;
      perplexity: number;
      claude: number;
    }
  >();

  for (const row of dailyTotals) {
    byDate.set(row.date, {
      total: row.sessions,
      ai: 0,
      google: 0,
      chatgpt: 0,
      perplexity: 0,
      claude: 0,
    });
  }

  for (const row of dailyBySource) {
    const bucket =
      byDate.get(row.date) ??
      ({
        total: 0,
        ai: 0,
        google: 0,
        chatgpt: 0,
        perplexity: 0,
        claude: 0,
      } as const);

    const id = classifySessionSource(row.source, row.medium);
    const next = { ...bucket };
    if (id === 'google') next.google += row.sessions;
    if (id === 'chatgpt') next.chatgpt += row.sessions;
    if (id === 'perplexity') next.perplexity += row.sessions;
    if (id === 'claude') next.claude += row.sessions;
    if (AI_SOURCE_CATALOG[id].isAiEngine) next.ai += row.sessions;
    byDate.set(row.date, next);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      label: shortDayLabel(date),
      ...values,
    }));
}

export async function buildAnalyticsDashboard(
  workspaceSlug: string,
  period: AnalyticsPeriod = 30,
): Promise<AnalyticsDashboard> {
  const cacheKey = `${workspaceSlug}:${period}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const config = resolveGoogleMetricsConfig(workspaceSlug);
  const googleConfigured = isGoogleMetricsConfigured(config);
  const ga4Configured = hasGa4Configured(config);

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - period);

  const [publications, publicationsInPeriod, metricSnapshots] = await Promise.all([
    prisma.publication.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { publishedAt: 'desc' },
      take: 8,
      include: {
        piece: { select: { title: true, slug: true } },
      },
    }),
    prisma.publication.count({
      where: {
        workspaceId: workspace.id,
        publishedAt: { gte: periodStart },
      },
    }),
    prisma.metricSnapshot.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { capturedAt: 'desc' },
      take: 100,
    }),
  ]);

  let clicks = { current: 0, previous: 0 };
  let impressions = { current: 0, previous: 0 };
  let blogSessions = { current: 0, previous: 0 };
  let sourceTotalsCurrent = emptySourceTotals();
  let sourceTotalsPrevious = emptySourceTotals();
  let dailySeries: AnalyticsDashboard['dailySeries'] = [];

  if (googleConfigured && config) {
    const gscResults = await Promise.all([
      fetchGscAggregateMetrics(config, { days: period, pageFilter: '/articulos/' }),
      fetchGscAggregateMetrics(config, { days: period, pageFilter: '/articulos/', offsetDays: period }),
    ]);
    clicks = { current: gscResults[0].clicks, previous: gscResults[1].clicks };
    impressions = { current: gscResults[0].impressions, previous: gscResults[1].impressions };

    if (ga4Configured) {
      const [totals, sourcesCurrent, sourcesPrevious, dailyTotals, dailyBySource] = await Promise.all([
        fetchGa4BlogSessionTotals(config, period),
        fetchGa4SessionsBySource(config, { days: period }),
        fetchGa4SessionsBySource(config, { days: period, offsetDays: period }),
        fetchGa4DailySessions(config, { days: period }),
        fetchGa4DailySessionsBySource(config, { days: period }),
      ]);

      blogSessions = totals;
      sourceTotalsCurrent = aggregateSources(sourcesCurrent);
      sourceTotalsPrevious = aggregateSources(sourcesPrevious);
      dailySeries = buildDailySeries(dailyTotals, dailyBySource);
    }
  }

  const snapshotByUrl = buildLatestSnapshotByUrl(metricSnapshots);

  const [gscPages, ga4Pages] = await Promise.all([
    googleConfigured && config
      ? fetchGscPageMetrics(config, { days: period, pageFilter: '/articulos/' })
      : Promise.resolve([]),
    googleConfigured && ga4Configured && config
      ? fetchGa4PageSessions(config, { days: period, pathPrefix: '/articulos/' })
      : Promise.resolve([]),
  ]);

  const topArticles = publications
    .map((pub) => {
      const url = pub.url ?? '';
      const path = url ? pathnameOf(url) : '';
      const snap = url ? snapshotByUrl[url] : undefined;
      const gsc = gscPages.find((row) => pathnameOf(row.url) === path);
      const ga4 = ga4Pages.find((row) => row.path.replace(/\/$/, '') === path);
      return {
        title: pub.piece.title,
        slug: pub.piece.slug,
        url: pub.url,
        clicks: gsc?.clicks ?? snap?.clicks ?? 0,
        impressions: gsc?.impressions ?? snap?.impressions ?? 0,
        sessions: ga4?.sessions ?? snap?.sessions ?? 0,
      };
    })
    .sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions))
    .slice(0, 8);

  const aiCurrent = aiSessionsFromTotals(sourceTotalsCurrent);
  const aiPrevious = aiSessionsFromTotals(sourceTotalsPrevious);
  const totalCurrent = blogSessions.current || topArticles.reduce((s, a) => s + a.sessions, 0);
  const totalPrevious = blogSessions.previous;
  const aiShareCurrent = totalCurrent > 0 ? Math.round((aiCurrent / totalCurrent) * 100) : 0;
  const aiSharePrevious =
    totalPrevious > 0 ? Math.round((aiPrevious / totalPrevious) * 100) : 0;

  const publicationCount = publications.length;
  const publicationPrevious = Math.max(publicationCount - publicationsInPeriod, 0);

  const displaySources: AiSourceId[] = [
    'chatgpt',
    'perplexity',
    'google',
    'claude',
    'copilot',
    'gemini',
    ...(sourceTotalsCurrent.other > 0 ? (['other'] as const) : []),
  ];
  const aiSources = displaySources
    .map((id) => {
      const current = sourceTotalsCurrent[id];
      const previous = sourceTotalsPrevious[id];
      return {
        id,
        label: AI_SOURCE_CATALOG[id].label,
        color: AI_SOURCE_CATALOG[id].color,
        sessions: current,
        change: pctChange(current, previous),
        share: totalCurrent > 0 ? Math.round((current / totalCurrent) * 100) : 0,
      };
    })
    .filter(
      (row) =>
        row.sessions > 0 ||
        ['chatgpt', 'perplexity', 'google', 'claude'].includes(row.id),
    )
    .sort((a, b) => b.sessions - a.sessions);

  const status = getGoogleMetricsStatus(workspaceSlug);

  const dashboard: AnalyticsDashboard = {
    workspace: { slug: workspace.slug, name: workspace.name },
    period,
    updatedAt: new Date().toISOString(),
    sources: {
      gsc: Boolean(status.configured),
      ga4: Boolean(status.ga4PropertyId),
    },
    kpis: {
      aiSessions: {
        label: 'Visitas desde IA',
        value: aiCurrent,
        change: pctChange(aiCurrent, aiPrevious),
      },
      totalSessions: {
        label: 'Visitas al blog',
        value: totalCurrent,
        change: pctChange(totalCurrent, totalPrevious),
      },
      aiShare: {
        label: '% tráfico vía IA',
        value: aiShareCurrent,
        change:
          aiSharePrevious > 0 || aiShareCurrent > 0
            ? aiShareCurrent - aiSharePrevious
            : null,
      },
      clicks: {
        label: 'Clicks Google',
        value: clicks.current,
        change: pctChange(clicks.current, clicks.previous),
      },
      impressions: {
        label: 'Impresiones Google',
        value: impressions.current,
        change: pctChange(impressions.current, impressions.previous),
      },
      publications: {
        label: 'Posts publicados',
        value: publicationCount,
        change: pctChange(publicationsInPeriod, Math.max(publicationPrevious, 1)),
      },
    },
    dailySeries,
    aiSources,
    topArticles,
    recentPublications: publications.map((pub) => ({
      id: pub.id,
      title: pub.piece.title,
      slug: pub.piece.slug,
      url: pub.url,
      publishedAt: pub.publishedAt?.toISOString() ?? null,
    })),
    insight: {
      newArticlesThisPeriod: publicationsInPeriod,
      message:
        publicationsInPeriod > 0
          ? `Teo publicó ${publicationsInPeriod} artículo${publicationsInPeriod === 1 ? '' : 's'} en los últimos ${period} días.`
          : 'Todavía no hay artículos nuevos en este período.',
    },
  };

  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data: dashboard });
  return dashboard;
}
