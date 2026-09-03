import {
  fetchGoogleTrendsExplore,
  fetchYoutubeOrganicSerp,
  type DataForSeoConfig,
} from '../../integrations/dataforseo';
import type {
  DiscoveryChannel,
  DiscoveryMarket,
  OpportunityBrief,
  YoutubeSourceData,
  YoutubeTopChannel,
  YoutubeTopVideo,
} from './types';

const STOP_TITLE = new Set([
  'the', 'and', 'for', 'with', 'from', 'how', 'what', 'why',
  'para', 'con', 'como', 'que', 'qué', 'una', 'uno', 'los', 'las', 'del', 'por',
  'guia', 'guía', 'mejor', 'mejores', 'vs', 'tutorial', 'curso', 'completo',
]);

function extractContentPatterns(titles: string[]): string[] {
  const counts = new Map<string, number>();
  for (const title of titles) {
    const tokens = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOP_TITLE.has(t));
    for (const t of tokens.slice(0, 8)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token, n]) => `${token} (×${n})`);
}

function trendFromGraphValues(
  points: Array<{ values: Array<number | null> }>,
): { interest: number | null; trend: YoutubeSourceData['trend'] } {
  const series = points
    .map((p) => {
      const nums = (p.values ?? []).filter((v): v is number => typeof v === 'number');
      if (!nums.length) return null;
      return nums[0] ?? null;
    })
    .filter((v): v is number => v != null);

  if (series.length < 4) {
    const last = series.length ? series[series.length - 1]! : null;
    return { interest: last, trend: series.length ? 'stable' : 'unknown' };
  }

  const recent = series.slice(-3);
  const older = series.slice(Math.max(0, series.length - 9), -3);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const r = avg(recent);
  const o = avg(older);
  const interest = Math.round(r);

  if (o <= 0 && r > 0) return { interest, trend: 'growing' };
  if (o <= 0) return { interest, trend: 'stable' };
  const ratio = r / o;
  if (ratio >= 1.15) return { interest, trend: 'growing' };
  if (ratio <= 0.85) return { interest, trend: 'declining' };
  return { interest, trend: 'stable' };
}

function aggregateChannels(
  videos: YoutubeTopVideo[],
  serpChannels: Array<{
    name: string;
    channelId: string | null;
    url: string | null;
    videoCount: number | null;
  }>,
): YoutubeTopChannel[] {
  const map = new Map<string, YoutubeTopChannel>();

  for (const ch of serpChannels) {
    const key = (ch.channelId || ch.name).toLowerCase();
    map.set(key, {
      name: ch.name,
      channelId: ch.channelId,
      url: ch.url,
      videoCount: ch.videoCount ?? 0,
      totalViews: 0,
    });
  }

  for (const v of videos) {
    if (!v.channelName) continue;
    const key = v.channelName.toLowerCase();
    const prev = map.get(key) ?? {
      name: v.channelName,
      channelId: null,
      url: null,
      videoCount: 0,
      totalViews: 0,
    };
    prev.videoCount += 1;
    prev.totalViews += v.views ?? 0;
    map.set(key, prev);
  }

  return [...map.values()]
    .sort((a, b) => b.totalViews - a.totalViews || b.videoCount - a.videoCount)
    .slice(0, 8);
}

export async function enrichBriefWithYoutube(
  config: DataForSeoConfig,
  brief: OpportunityBrief,
  market: DiscoveryMarket,
): Promise<{ brief: OpportunityBrief; cost: number }> {
  const keyword = brief.primaryQuery;
  let cost = 0;

  let youtube: YoutubeSourceData = {
    interest: null,
    trend: 'unknown',
    relatedQueries: [],
    relatedTopics: [],
    topVideos: [],
    topChannels: [],
    contentPatterns: [],
    cost: 0,
    fetchedAt: new Date().toISOString(),
  };

  try {
    const serp = await fetchYoutubeOrganicSerp(config, {
      keyword,
      locationName: market.locationName,
      languageCode: market.languageCode,
      blockDepth: 20,
    });
    cost += serp.cost;

    const topVideos: YoutubeTopVideo[] = serp.videos.slice(0, 12).map((v) => ({
      title: v.title,
      videoId: v.videoId,
      url: v.url,
      channelName: v.channelName,
      views: v.viewsCount,
      rank: v.rankAbsolute,
      isShorts: v.isShorts,
    }));

    youtube = {
      ...youtube,
      topVideos,
      topChannels: aggregateChannels(
        topVideos,
        serp.channels.map((c) => ({
          name: c.name,
          channelId: c.channelId,
          url: c.url,
          videoCount: c.videoCount,
        })),
      ),
      contentPatterns: extractContentPatterns(topVideos.map((v) => v.title)),
    };
  } catch (err) {
    console.warn(
      '[discovery] youtube serp falló:',
      keyword,
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const graph = await fetchGoogleTrendsExplore(config, {
      keywords: [keyword],
      type: 'youtube',
      locationName: market.locationName,
      languageCode: market.languageCode,
      timeRange: 'past_12_months',
      itemTypes: ['google_trends_graph'],
    });
    cost += graph.cost;
    const trendInfo = trendFromGraphValues(graph.graph);
    const avgInterest =
      graph.averages.find((v) => typeof v === 'number') ?? trendInfo.interest;
    youtube = {
      ...youtube,
      interest: typeof avgInterest === 'number' ? Math.round(avgInterest) : trendInfo.interest,
      trend: trendInfo.trend,
    };
  } catch (err) {
    console.warn(
      '[discovery] youtube trends graph falló:',
      keyword,
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const queries = await fetchGoogleTrendsExplore(config, {
      keywords: [keyword],
      type: 'youtube',
      locationName: market.locationName,
      languageCode: market.languageCode,
      timeRange: 'past_12_months',
      itemTypes: ['google_trends_queries_list'],
    });
    cost += queries.cost;
    youtube = {
      ...youtube,
      relatedQueries: queries.relatedQueries
        .filter((q): q is typeof q & { query: string } => Boolean(q.query))
        .map((q) => ({
          query: q.query!,
          value: q.value,
          kind: q.kind,
        }))
        .slice(0, 20),
    };
  } catch (err) {
    console.warn(
      '[discovery] youtube trends queries falló:',
      keyword,
      err instanceof Error ? err.message : err,
    );
  }

  youtube = { ...youtube, cost, fetchedAt: new Date().toISOString() };

  const googleSource = brief.sources?.google ?? {
    monthlySearches: brief.monthlySearches,
    demandScore: brief.demandScore,
    trendScore: brief.trendScore,
    trendLabel: brief.trend,
    dfsSources: [],
  };

  const hasYoutubeSignal =
    youtube.topVideos.length > 0 ||
    (typeof youtube.interest === 'number' && youtube.interest > 0) ||
    youtube.relatedQueries.length > 0;

  const channels = new Set<DiscoveryChannel>(brief.channels ?? ['google']);
  if (hasYoutubeSignal) channels.add('youtube');

  const relatedFromYt = youtube.relatedQueries
    .slice(0, 5)
    .map((q) => q.query)
    .filter(Boolean);

  return {
    cost,
    brief: {
      ...brief,
      channels: [...channels],
      relatedQueries: [
        ...new Set([...(brief.relatedQueries ?? []), ...relatedFromYt]),
      ].slice(0, 12),
      sources: {
        google: googleSource,
        youtube,
      },
    },
  };
}

export async function enrichBriefsWithYoutube(
  config: DataForSeoConfig,
  briefs: OpportunityBrief[],
  market: DiscoveryMarket,
  maxKeywords: number,
): Promise<{ briefs: OpportunityBrief[]; cost: number; enriched: number }> {
  const limit = Math.min(20, Math.max(0, maxKeywords));
  const target = briefs.slice(0, limit);
  const rest = briefs.slice(limit);
  let totalCost = 0;
  let enriched = 0;
  const out: OpportunityBrief[] = [];

  for (const brief of target) {
    const result = await enrichBriefWithYoutube(config, brief, market);
    totalCost += result.cost;
    if (result.brief.sources?.youtube) enriched += 1;
    out.push(result.brief);
  }

  return {
    briefs: [...out, ...rest],
    cost: totalCost,
    enriched,
  };
}
