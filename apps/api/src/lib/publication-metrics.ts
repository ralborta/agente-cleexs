import { prisma } from './prisma';
import { fetchGa4PageSessions } from './integrations/google-ga4';
import { fetchGscPageMetrics } from './integrations/google-gsc';
import {
  hasGa4Configured,
  isGoogleMetricsConfigured,
  resolveGoogleMetricsConfig,
} from './integrations/google-config';
import type { AnalyticsPeriod } from './analytics-dashboard';

export type PublicationPerformanceRow = {
  pieceId: string;
  publicationId: string;
  title: string;
  slug: string | null;
  url: string | null;
  publishedAt: string | null;
  agentSlug: string;
  agentName: string;
  pieceType: string;
  impressions: number;
  clicks: number;
  ctr: number;
  sessions: number;
  ctaClicks: number;
  ctaSubmits: number;
  gscSubmitStatus: string | null;
  indexNowStatus: string | null;
  score: number;
};

export type PublicationPerformanceReport = {
  workspace: { slug: string; name: string };
  period: AnalyticsPeriod;
  updatedAt: string;
  agent: string | null;
  sources: { gsc: boolean; ga4: boolean; cta: boolean };
  kpis: {
    publications: number;
    impressions: number;
    clicks: number;
    sessions: number;
    ctaEvents: number;
    indexedOk: number;
  };
  agents: Array<{ slug: string; name: string; publications: number }>;
  rows: PublicationPerformanceRow[];
};

function pathnameOf(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return url.replace(/\/$/, '');
  }
}

function ctrOf(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 1000) / 10;
}

export async function buildPublicationPerformance(
  workspaceSlug: string,
  period: AnalyticsPeriod,
  agentSlug?: string | null,
): Promise<PublicationPerformanceReport> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const config = resolveGoogleMetricsConfig(workspaceSlug);
  const googleConfigured = isGoogleMetricsConfigured(config);
  const ga4Configured = hasGa4Configured(config);
  const since = new Date(Date.now() - period * 24 * 3600_000);

  const publications = await prisma.publication.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { publishedAt: 'desc' },
    include: {
      piece: {
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          mission: {
            select: {
              agent: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  const [gscPages, ga4Pages, ctaGroups, agents] = await Promise.all([
    googleConfigured && config
      ? fetchGscPageMetrics(config, { days: period, pageFilter: '/articulos/' }).catch(() => [])
      : Promise.resolve([]),
    googleConfigured && ga4Configured && config
      ? fetchGa4PageSessions(config, { days: period, pathPrefix: '/articulos/' }).catch(() => [])
      : Promise.resolve([]),
    prisma.ctaEvent.groupBy({
      by: ['pieceId', 'eventType'],
      where: {
        workspaceId: workspace.id,
        createdAt: { gte: since },
        pieceId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.agent.findMany({
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const ctaByPiece = new Map<string, { click: number; submit: number }>();
  for (const row of ctaGroups) {
    if (!row.pieceId) continue;
    const cur = ctaByPiece.get(row.pieceId) ?? { click: 0, submit: 0 };
    if (row.eventType === 'click') cur.click += row._count._all;
    else cur.submit += row._count._all;
    ctaByPiece.set(row.pieceId, cur);
  }

  const rows: PublicationPerformanceRow[] = publications.map((pub) => {
    const agent = pub.piece.mission?.agent;
    const agentSlugResolved = agent?.slug ?? 'teo';
    const agentName = agent?.name ?? 'Teo';
    const url = pub.url ?? null;
    const path = url ? pathnameOf(url) : '';
    const gsc = path
      ? gscPages.find((row) => pathnameOf(row.url) === path)
      : undefined;
    const ga4 = path
      ? ga4Pages.find((row) => row.path.replace(/\/$/, '') === path)
      : undefined;
    const cta = ctaByPiece.get(pub.pieceId) ?? { click: 0, submit: 0 };
    const impressions = gsc?.impressions ?? 0;
    const clicks = gsc?.clicks ?? 0;
    const sessions = ga4?.sessions ?? 0;
    const score = clicks * 3 + sessions + cta.click + cta.submit * 2;

    return {
      pieceId: pub.pieceId,
      publicationId: pub.id,
      title: pub.piece.title,
      slug: pub.piece.slug,
      url,
      publishedAt: pub.publishedAt?.toISOString() ?? null,
      agentSlug: agentSlugResolved,
      agentName,
      pieceType: pub.piece.type,
      impressions,
      clicks,
      ctr: gsc?.ctr != null ? Math.round(gsc.ctr * 1000) / 10 : ctrOf(clicks, impressions),
      sessions,
      ctaClicks: cta.click,
      ctaSubmits: cta.submit,
      gscSubmitStatus: pub.gscSubmitStatus,
      indexNowStatus: pub.indexNowStatus,
      score,
    };
  });

  const filtered = agentSlug
    ? rows.filter((row) => row.agentSlug === agentSlug)
    : rows;

  filtered.sort((a, b) => b.score - a.score || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const agentCounts = new Map<string, { slug: string; name: string; publications: number }>();
  for (const row of rows) {
    const cur = agentCounts.get(row.agentSlug) ?? {
      slug: row.agentSlug,
      name: row.agentName,
      publications: 0,
    };
    cur.publications += 1;
    agentCounts.set(row.agentSlug, cur);
  }
  // include known agents even with 0 pubs
  for (const agent of agents) {
    if (!agentCounts.has(agent.slug)) {
      agentCounts.set(agent.slug, { slug: agent.slug, name: agent.name, publications: 0 });
    }
  }

  const kpis = {
    publications: filtered.length,
    impressions: filtered.reduce((s, r) => s + r.impressions, 0),
    clicks: filtered.reduce((s, r) => s + r.clicks, 0),
    sessions: filtered.reduce((s, r) => s + r.sessions, 0),
    ctaEvents: filtered.reduce((s, r) => s + r.ctaClicks + r.ctaSubmits, 0),
    indexedOk: filtered.filter(
      (r) => r.indexNowStatus === 'ok' || r.gscSubmitStatus === 'ok',
    ).length,
  };

  return {
    workspace: { slug: workspace.slug, name: workspace.name },
    period,
    updatedAt: new Date().toISOString(),
    agent: agentSlug ?? null,
    sources: {
      gsc: googleConfigured,
      ga4: ga4Configured,
      cta: true,
    },
    kpis,
    agents: [...agentCounts.values()].sort((a, b) => b.publications - a.publications),
    rows: filtered,
  };
}
