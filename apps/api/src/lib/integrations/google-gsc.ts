import type { GoogleMetricsConfig } from './google-config';
import { getGoogleAccessToken } from './google-auth';

export type GscPageRow = {
  url: string;
  impressions: number;
  clicks: number;
  ctr: number;
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

export async function fetchGscPageMetrics(
  config: GoogleMetricsConfig,
  options?: { days?: number; pageFilter?: string },
): Promise<GscPageRow[]> {
  const days = options?.days ?? 28;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const site = encodeSiteUrl(config.gscSiteUrl);
  const token = await getGoogleAccessToken(config, ['https://www.googleapis.com/auth/webmasters.readonly']);

  const body: Record<string, unknown> = {
    startDate: formatDate(start),
    endDate: formatDate(end),
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

  const data = (await res.json()) as GscQueryResponse;
  return (data.rows ?? []).map((row) => ({
    url: row.keys?.[0] ?? '',
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
  }));
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
