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
