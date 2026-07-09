import type { GoogleMetricsConfig } from './google-config';
import { googleFetch } from './google-auth';

export type Ga4PageRow = {
  path: string;
  sessions: number;
};

type Ga4ReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

export async function fetchGa4PageSessions(
  config: GoogleMetricsConfig,
  options?: { days?: number; pathPrefix?: string },
): Promise<Ga4PageRow[]> {
  const pathPrefix = options?.pathPrefix ?? '/articulos/';
  const propertyId = config.ga4PropertyId;

  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: `${options?.days ?? 28}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: pathPrefix },
      },
    },
    limit: 10000,
  };

  const data = await googleFetch<Ga4ReportResponse>(
    config,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    },
  );

  return (data.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function testGa4Connection(config: GoogleMetricsConfig) {
  const rows = await fetchGa4PageSessions(config, { days: 7, pathPrefix: '/' });
  return {
    ok: true,
    samplePages: rows.slice(0, 5),
    totalPaths: rows.length,
    propertyId: config.ga4PropertyId,
  };
}
