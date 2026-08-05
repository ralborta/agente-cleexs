import type { GoogleMetricsConfig } from './google-config';
import { getGoogleAccessToken } from './google-auth';

export type GscPageRow = {
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type GscAggregate = {
  clicks: number;
  impressions: number;
};

type GscQueryResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
  }>;
};

function encodeSiteUrl(siteUrl: string) {
  return encodeURIComponent(siteUrl);
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateRangeForPeriod(days: number, offsetDays = 0) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - offsetDays);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: formatDate(start), end: formatDate(end) };
}

export async function listGscSites(config: GoogleMetricsConfig): Promise<string[]> {
  const token = await getGoogleAccessToken(config, ['https://www.googleapis.com/auth/webmasters.readonly']);
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GSC sites ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { siteEntry?: Array<{ siteUrl?: string }> };
  return (data.siteEntry ?? []).map((s) => s.siteUrl).filter(Boolean) as string[];
}

async function runGscQuery(
  config: GoogleMetricsConfig,
  body: Record<string, unknown>,
): Promise<GscQueryResponse> {
  const site = encodeSiteUrl(config.gscSiteUrl);
  const token = await getGoogleAccessToken(config, ['https://www.googleapis.com/auth/webmasters.readonly']);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`GSC query ${res.status}: ${errBody.slice(0, 400)}`);
  }

  return (await res.json()) as GscQueryResponse;
}

export async function fetchGscPageMetrics(
  config: GoogleMetricsConfig,
  options?: { days?: number; pageFilter?: string; offsetDays?: number },
): Promise<GscPageRow[]> {
  const days = options?.days ?? 28;
  const range = dateRangeForPeriod(days, options?.offsetDays ?? 0);

  const body: Record<string, unknown> = {
    startDate: range.start,
    endDate: range.end,
    dimensions: ['page'],
    rowLimit: 25000,
  };

  if (options?.pageFilter) {
    body.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'page',
            operator: 'contains',
            expression: options.pageFilter,
          },
        ],
      },
    ];
  }

  const data = await runGscQuery(config, body);
  return (data.rows ?? []).map((row) => ({
    url: row.keys?.[0] ?? '',
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
  }));
}

export async function fetchGscAggregateMetrics(
  config: GoogleMetricsConfig,
  options?: { days?: number; pageFilter?: string; offsetDays?: number },
): Promise<GscAggregate> {
  const days = options?.days ?? 28;
  const range = dateRangeForPeriod(days, options?.offsetDays ?? 0);

  const body: Record<string, unknown> = {
    startDate: range.start,
    endDate: range.end,
    rowLimit: 1,
  };

  if (options?.pageFilter) {
    body.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'page',
            operator: 'contains',
            expression: options.pageFilter,
          },
        ],
      },
    ];
  }

  const data = await runGscQuery(config, body);
  const row = data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
  };
}

export type GscQueryRow = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

/** Queries reales que ya buscan en Google (dimensión query de Search Console). */
export async function fetchGscQueryMetrics(
  config: GoogleMetricsConfig,
  options?: { days?: number; rowLimit?: number },
): Promise<GscQueryRow[]> {
  const days = options?.days ?? 28;
  const range = dateRangeForPeriod(days, 0);

  const data = await runGscQuery(config, {
    startDate: range.start,
    endDate: range.end,
    dimensions: ['query'],
    rowLimit: options?.rowLimit ?? 1000,
  });

  return (data.rows ?? [])
    .map((row) => ({
      query: (row.keys?.[0] ?? '').trim(),
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      ctr: row.ctr ?? 0,
    }))
    .filter((row) => row.query.length > 0);
}

export type UrlIndexStatus = {
  url: string;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'UNKNOWN';
  coverageState: string | null;
  indexed: boolean;
  lastCrawlTime: string | null;
  robotsTxtState: string | null;
};

/** URL Inspection API — estado real de indexación de una URL puntual. */
export async function inspectUrlIndexStatus(
  config: GoogleMetricsConfig,
  inspectionUrl: string,
): Promise<UrlIndexStatus> {
  const token = await getGoogleAccessToken(config, ['https://www.googleapis.com/auth/webmasters.readonly']);

  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inspectionUrl, siteUrl: config.gscSiteUrl }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GSC urlInspection ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        lastCrawlTime?: string;
        robotsTxtState?: string;
      };
    };
  };

  const result = data.inspectionResult?.indexStatusResult;
  const coverageState = result?.coverageState ?? null;
  return {
    url: inspectionUrl,
    verdict: (result?.verdict as UrlIndexStatus['verdict']) ?? 'UNKNOWN',
    coverageState,
    indexed: Boolean(coverageState?.toLowerCase().includes('indexed')),
    lastCrawlTime: result?.lastCrawlTime ?? null,
    robotsTxtState: result?.robotsTxtState ?? null,
  };
}

export async function testGscConnection(config: GoogleMetricsConfig) {
  const sites = await listGscSites(config);
  const hasSite = sites.some(
    (s) => s === config.gscSiteUrl || s.replace(/\/$/, '') === config.gscSiteUrl.replace(/\/$/, ''),
  );
  return {
    ok: hasSite,
    sites,
    configuredSite: config.gscSiteUrl,
    hasAccess: hasSite,
  };
}
