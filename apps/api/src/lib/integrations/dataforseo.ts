/**
 * Cliente HTTP DataForSEO (Keywords Data API).
 * Sandbox: https://sandbox.dataforseo.com — gratis, estructura real.
 * Live: https://api.dataforseo.com — consume crédito (trial US$1 al registrarte).
 */
export type DataForSeoMode = 'sandbox' | 'live';

export type DataForSeoConfig = {
  login: string;
  password: string;
  mode: DataForSeoMode;
};

export type MonthlySearchPoint = {
  year: number;
  month: number;
  search_volume: number | null;
};

export type DataForSeoKeywordRow = {
  keyword: string;
  location_code?: number | null;
  language_code?: string | null;
  search_volume: number | null;
  competition?: string | null;
  competition_index?: number | null;
  cpc?: number | null;
  monthly_searches?: MonthlySearchPoint[] | null;
};

type DataForSeoTaskResponse = {
  version?: string;
  status_code?: number;
  status_message?: string;
  cost?: number;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    cost?: number;
    result?: unknown;
  }>;
};

export function resolveDataForSeoConfig(): DataForSeoConfig | null {
  const login = (process.env.DATAFORSEO_LOGIN ?? '').trim();
  const password = (process.env.DATAFORSEO_PASSWORD ?? '').trim();
  if (!login || !password) return null;

  const raw = (process.env.DATAFORSEO_MODE ?? 'sandbox').trim().toLowerCase();
  const mode: DataForSeoMode = raw === 'live' ? 'live' : 'sandbox';
  return { login, password, mode };
}

export function isDataForSeoConfigured(): boolean {
  return resolveDataForSeoConfig() !== null;
}

function baseUrl(mode: DataForSeoMode): string {
  return mode === 'live'
    ? 'https://api.dataforseo.com'
    : 'https://sandbox.dataforseo.com';
}

async function dataForSeoPost<T>(
  config: DataForSeoConfig,
  path: string,
  body: unknown[],
): Promise<T> {
  const url = `${baseUrl(config.mode)}${path}`;
  const auth = Buffer.from(`${config.login}:${config.password}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: T & { status_code?: number; status_message?: string };
  try {
    json = JSON.parse(text) as T & { status_code?: number; status_message?: string };
  } catch {
    throw new Error(`DataForSEO respuesta no JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `DataForSEO HTTP ${res.status}: ${json.status_message ?? text.slice(0, 200)}`,
    );
  }

  if (typeof json.status_code === 'number' && json.status_code >= 40000) {
    throw new Error(`DataForSEO ${json.status_code}: ${json.status_message ?? 'error'}`);
  }

  return json;
}

function flattenAdsKeywordResults(payload: DataForSeoTaskResponse): DataForSeoKeywordRow[] {
  const rows: DataForSeoKeywordRow[] = [];
  for (const task of payload.tasks ?? []) {
    if (task.status_code && task.status_code >= 40000) {
      console.warn('[dataforseo] task error', task.status_code, task.status_message);
      continue;
    }
    const result = task.result;
    if (!Array.isArray(result)) continue;
    for (const row of result as DataForSeoKeywordRow[]) {
      if (!row?.keyword) continue;
      rows.push(row);
    }
  }
  return rows;
}

type LabsKeywordInfo = {
  search_volume?: number | null;
  competition?: number | null;
  cpc?: number | null;
  monthly_searches?: MonthlySearchPoint[] | null;
};

type LabsItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: LabsKeywordInfo;
  };
  keyword?: string;
  keyword_info?: LabsKeywordInfo;
};

function flattenLabsItems(payload: DataForSeoTaskResponse): DataForSeoKeywordRow[] {
  const rows: DataForSeoKeywordRow[] = [];
  for (const task of payload.tasks ?? []) {
    if (task.status_code && task.status_code >= 40000) {
      console.warn('[dataforseo] labs task error', task.status_code, task.status_message);
      continue;
    }
    const results = Array.isArray(task.result) ? task.result : [];
    for (const block of results as Array<{ items?: LabsItem[] }>) {
      for (const item of block.items ?? []) {
        const keyword = (item.keyword_data?.keyword ?? item.keyword ?? '').trim();
        if (!keyword) continue;
        const info = item.keyword_data?.keyword_info ?? item.keyword_info;
        rows.push({
          keyword,
          search_volume: info?.search_volume ?? null,
          competition_index:
            typeof info?.competition === 'number'
              ? Math.round(info.competition * 100)
              : null,
          cpc: info?.cpc ?? null,
          monthly_searches: info?.monthly_searches ?? null,
        });
      }
    }
  }
  return rows;
}

export type KeywordsForKeywordsInput = {
  keywords: string[];
  locationCode?: number;
  languageCode?: string;
  sortBy?: 'relevance' | 'search_volume' | 'competition_index';
};

/** Hasta 20 seeds → ideas + volumen (Google Ads Keyword Planner). */
export async function fetchKeywordsForKeywords(
  config: DataForSeoConfig,
  input: KeywordsForKeywordsInput,
): Promise<{ rows: DataForSeoKeywordRow[]; cost: number; mode: DataForSeoMode }> {
  const keywords = [
    ...new Set(
      input.keywords
        .map((k) => k.replace(/\s+/g, ' ').trim().toLowerCase())
        .filter((k) => k.length >= 2 && k.length <= 80),
    ),
  ].slice(0, 20);

  if (!keywords.length) {
    return { rows: [], cost: 0, mode: config.mode };
  }

  const task: Record<string, unknown> = {
    keywords,
    sort_by: input.sortBy ?? 'search_volume',
  };
  if (input.locationCode) task.location_code = input.locationCode;
  if (input.languageCode) task.language_code = input.languageCode;

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/keywords_data/google_ads/keywords_for_keywords/live',
    [task],
  );

  return {
    rows: flattenAdsKeywordResults(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}

export type KeywordsForSiteInput = {
  target: string;
  locationCode?: number;
  languageCode?: string;
};

/** Ideas a partir de la URL del sitio. */
export async function fetchKeywordsForSite(
  config: DataForSeoConfig,
  input: KeywordsForSiteInput,
): Promise<{ rows: DataForSeoKeywordRow[]; cost: number; mode: DataForSeoMode }> {
  const target = input.target.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
  if (!target) return { rows: [], cost: 0, mode: config.mode };

  const task: Record<string, unknown> = { target };
  if (input.locationCode) task.location_code = input.locationCode;
  if (input.languageCode) task.language_code = input.languageCode;

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/keywords_data/google_ads/keywords_for_site/live',
    [task],
  );

  return {
    rows: flattenAdsKeywordResults(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}

export type RelatedKeywordsInput = {
  keyword: string;
  locationCode: number;
  languageCode: string;
  /** 1≈8, 2≈72, 3≈584 related */
  depth?: number;
  limit?: number;
};

/** “Búsquedas relacionadas” de Google SERP (Labs) — mucha más expansión. */
export async function fetchRelatedKeywords(
  config: DataForSeoConfig,
  input: RelatedKeywordsInput,
): Promise<{ rows: DataForSeoKeywordRow[]; cost: number; mode: DataForSeoMode }> {
  const keyword = input.keyword.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!keyword) return { rows: [], cost: 0, mode: config.mode };

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/dataforseo_labs/google/related_keywords/live',
    [
      {
        keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        depth: input.depth ?? 2,
        limit: input.limit ?? 100,
        include_seed_keyword: true,
      },
    ],
  );

  return {
    rows: flattenLabsItems(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}

export type KeywordSuggestionsInput = {
  keyword: string;
  locationCode: number;
  languageCode: string;
  limit?: number;
};

/** Long-tails que contienen la frase semilla (full-text Labs). */
export async function fetchKeywordSuggestions(
  config: DataForSeoConfig,
  input: KeywordSuggestionsInput,
): Promise<{ rows: DataForSeoKeywordRow[]; cost: number; mode: DataForSeoMode }> {
  const keyword = input.keyword.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!keyword) return { rows: [], cost: 0, mode: config.mode };

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/dataforseo_labs/google/keyword_suggestions/live',
    [
      {
        keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        limit: input.limit ?? 80,
        include_seed_keyword: true,
      },
    ],
  );

  return {
    rows: flattenLabsItems(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}

// ─── YouTube Discovery (SERP + Trends) ─────────────────────────────────────

export type YoutubeSerpVideo = {
  type: 'youtube_video' | 'youtube_video_paid';
  title: string;
  videoId: string;
  url: string | null;
  channelName: string | null;
  channelId: string | null;
  channelUrl: string | null;
  viewsCount: number | null;
  rankAbsolute: number | null;
  publicationDate: string | null;
  isShorts: boolean;
};

export type YoutubeSerpChannel = {
  type: 'youtube_channel';
  name: string;
  channelId: string | null;
  url: string | null;
  videoCount: number | null;
  rankAbsolute: number | null;
};

export type YoutubeOrganicInput = {
  keyword: string;
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  blockDepth?: number;
};

type YoutubeSerpItem = {
  type?: string;
  title?: string;
  name?: string;
  url?: string;
  video_id?: string;
  channel_id?: string;
  channel_name?: string;
  channel_url?: string;
  views_count?: number | null;
  video_count?: number | null;
  rank_absolute?: number | null;
  publication_date?: string | null;
  is_shorts?: boolean;
};

function flattenYoutubeOrganic(payload: DataForSeoTaskResponse): {
  videos: YoutubeSerpVideo[];
  channels: YoutubeSerpChannel[];
} {
  const videos: YoutubeSerpVideo[] = [];
  const channels: YoutubeSerpChannel[] = [];

  for (const task of payload.tasks ?? []) {
    if (task.status_code && task.status_code >= 40000) {
      console.warn('[dataforseo] youtube serp task error', task.status_code, task.status_message);
      continue;
    }
    const results = Array.isArray(task.result) ? task.result : [];
    for (const block of results as Array<{ items?: YoutubeSerpItem[] }>) {
      for (const item of block.items ?? []) {
        const type = item.type ?? '';
        if (type === 'youtube_video' || type === 'youtube_video_paid') {
          const title = (item.title ?? '').trim();
          const videoId = (item.video_id ?? '').trim();
          if (!title || !videoId) continue;
          videos.push({
            type,
            title,
            videoId,
            url: item.url ?? null,
            channelName: item.channel_name ?? null,
            channelId: item.channel_id ?? null,
            channelUrl: item.channel_url ?? null,
            viewsCount: typeof item.views_count === 'number' ? item.views_count : null,
            rankAbsolute: typeof item.rank_absolute === 'number' ? item.rank_absolute : null,
            publicationDate: item.publication_date ?? null,
            isShorts: Boolean(item.is_shorts),
          });
        } else if (type === 'youtube_channel') {
          const name = (item.name ?? item.title ?? '').trim();
          if (!name) continue;
          channels.push({
            type: 'youtube_channel',
            name,
            channelId: item.channel_id ?? null,
            url: item.url ?? null,
            videoCount: typeof item.video_count === 'number' ? item.video_count : null,
            rankAbsolute: typeof item.rank_absolute === 'number' ? item.rank_absolute : null,
          });
        }
      }
    }
  }

  return { videos, channels };
}

/** SERP orgánico de YouTube para una keyword. */
export async function fetchYoutubeOrganicSerp(
  config: DataForSeoConfig,
  input: YoutubeOrganicInput,
): Promise<{
  videos: YoutubeSerpVideo[];
  channels: YoutubeSerpChannel[];
  cost: number;
  mode: DataForSeoMode;
}> {
  const keyword = input.keyword.replace(/\s+/g, ' ').trim();
  if (!keyword) {
    return { videos: [], channels: [], cost: 0, mode: config.mode };
  }

  const task: Record<string, unknown> = {
    keyword,
    block_depth: input.blockDepth ?? 20,
  };
  if (input.locationName) task.location_name = input.locationName;
  else if (input.locationCode) task.location_code = input.locationCode;
  else task.location_name = 'Argentina';

  if (input.languageCode) task.language_code = input.languageCode;
  else task.language_code = 'es';

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/serp/youtube/organic/live/advanced',
    [task],
  );

  const flat = flattenYoutubeOrganic(payload);
  return {
    ...flat,
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}

export type TrendsExploreInput = {
  keywords: string[];
  type?: 'web' | 'news' | 'youtube' | 'images' | 'froogle';
  locationName?: string;
  locationCode?: number;
  languageCode?: string;
  timeRange?: string;
  itemTypes?: Array<
    | 'google_trends_graph'
    | 'google_trends_map'
    | 'google_trends_topics_list'
    | 'google_trends_queries_list'
  >;
};

export type TrendsGraphPoint = {
  dateFrom: string | null;
  dateTo: string | null;
  values: Array<number | null>;
};

export type TrendsRelatedItem = {
  query?: string;
  title?: string;
  value: string;
  kind: 'top' | 'rising';
};

export type TrendsExploreResult = {
  averages: number[];
  graph: TrendsGraphPoint[];
  relatedQueries: TrendsRelatedItem[];
  relatedTopics: TrendsRelatedItem[];
  cost: number;
  mode: DataForSeoMode;
};

type TrendsItem = {
  type?: string;
  averages?: number[] | null;
  data?:
    | Array<{
        date_from?: string;
        date_to?: string;
        values?: Array<number | null>;
      }>
    | {
        top?: Array<{
          query?: string;
          topic_title?: string;
          title?: string;
          value?: string | number;
        }>;
        rising?: Array<{
          query?: string;
          topic_title?: string;
          title?: string;
          value?: string | number;
        }>;
      }
    | null;
};

function flattenTrendsExplore(
  payload: DataForSeoTaskResponse,
): Omit<TrendsExploreResult, 'cost' | 'mode'> {
  const graph: TrendsGraphPoint[] = [];
  const relatedQueries: TrendsRelatedItem[] = [];
  const relatedTopics: TrendsRelatedItem[] = [];
  let averages: number[] = [];

  for (const task of payload.tasks ?? []) {
    if (task.status_code && task.status_code >= 40000) {
      console.warn('[dataforseo] trends task error', task.status_code, task.status_message);
      continue;
    }
    const results = Array.isArray(task.result) ? task.result : [];
    for (const block of results as Array<{ items?: TrendsItem[] }>) {
      for (const item of block.items ?? []) {
        const type = item.type ?? '';
        if (type === 'google_trends_graph') {
          if (Array.isArray(item.averages)) averages = item.averages;
          if (Array.isArray(item.data)) {
            for (const point of item.data) {
              graph.push({
                dateFrom: point.date_from ?? null,
                dateTo: point.date_to ?? null,
                values: Array.isArray(point.values) ? point.values : [],
              });
            }
          }
        } else if (type === 'google_trends_queries_list' && item.data && !Array.isArray(item.data)) {
          for (const row of item.data.top ?? []) {
            const query = (row.query ?? '').trim();
            if (!query) continue;
            relatedQueries.push({
              query,
              value: String(row.value ?? ''),
              kind: 'top',
            });
          }
          for (const row of item.data.rising ?? []) {
            const query = (row.query ?? '').trim();
            if (!query) continue;
            relatedQueries.push({
              query,
              value: String(row.value ?? ''),
              kind: 'rising',
            });
          }
        } else if (type === 'google_trends_topics_list' && item.data && !Array.isArray(item.data)) {
          for (const row of item.data.top ?? []) {
            const title = (row.topic_title ?? row.title ?? row.query ?? '').trim();
            if (!title) continue;
            relatedTopics.push({
              title,
              value: String(row.value ?? ''),
              kind: 'top',
            });
          }
          for (const row of item.data.rising ?? []) {
            const title = (row.topic_title ?? row.title ?? row.query ?? '').trim();
            if (!title) continue;
            relatedTopics.push({
              title,
              value: String(row.value ?? ''),
              kind: 'rising',
            });
          }
        }
      }
    }
  }

  return { averages, graph, relatedQueries, relatedTopics };
}

/** Google Trends Explore (web / youtube / …). */
export async function fetchGoogleTrendsExplore(
  config: DataForSeoConfig,
  input: TrendsExploreInput,
): Promise<TrendsExploreResult> {
  const keywords = [
    ...new Set(
      input.keywords
        .map((k) => k.replace(/\s+/g, ' ').trim())
        .filter((k) => k.length >= 2 && k.length <= 100),
    ),
  ].slice(0, 5);

  if (!keywords.length) {
    return {
      averages: [],
      graph: [],
      relatedQueries: [],
      relatedTopics: [],
      cost: 0,
      mode: config.mode,
    };
  }

  const itemTypes = input.itemTypes ?? ['google_trends_graph'];
  const needsSingleKeyword = itemTypes.some(
    (t) => t === 'google_trends_queries_list' || t === 'google_trends_topics_list',
  );
  const taskKeywords = needsSingleKeyword ? keywords.slice(0, 1) : keywords;

  const task: Record<string, unknown> = {
    keywords: taskKeywords,
    type: input.type ?? 'web',
    item_types: itemTypes,
    time_range: input.timeRange ?? 'past_12_months',
  };
  if (input.locationName) task.location_name = input.locationName;
  else if (input.locationCode) task.location_code = input.locationCode;
  if (input.languageCode) task.language_code = input.languageCode;

  const payload = await dataForSeoPost<DataForSeoTaskResponse>(
    config,
    '/v3/keywords_data/google_trends/explore/live',
    [task],
  );

  return {
    ...flattenTrendsExplore(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}
