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
  sources: { gsc: boolean; ga4: boolean };
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
    id: string;
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

export function formatMetric(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

export function trendLabel(change: number | null, suffix = '% vs período anterior') {
  if (change === null) return null;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change}${suffix.includes('pts') ? ' pts' : '%'} ${suffix.includes('pts') ? 'vs período anterior' : suffix.replace('% ', '')}`;
}
