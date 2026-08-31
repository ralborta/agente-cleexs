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
    result?: DataForSeoKeywordRow[] | null;
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

function flattenKeywordResults(payload: DataForSeoTaskResponse): DataForSeoKeywordRow[] {
  const rows: DataForSeoKeywordRow[] = [];
  for (const task of payload.tasks ?? []) {
    if (task.status_code && task.status_code >= 40000) {
      console.warn('[dataforseo] task error', task.status_code, task.status_message);
      continue;
    }
    for (const row of task.result ?? []) {
      if (!row?.keyword) continue;
      rows.push(row);
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

/** Hasta 20 seeds → ideas + volumen (Google Ads). */
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
    rows: flattenKeywordResults(payload),
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
    rows: flattenKeywordResults(payload),
    cost: payload.cost ?? 0,
    mode: config.mode,
  };
}
