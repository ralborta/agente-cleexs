import type { GoogleMetricsConfig } from './google-config';
import { googleFetch } from './google-auth';

export type Ga4PageRow = {
  path: string;
  sessions: number;
};

export type Ga4DailyRow = {
  date: string;
  sessions: number;
};

export type Ga4SourceRow = {
  source: string;
  medium: string;
  sessions: number;
};

export type Ga4DailySourceRow = {
  date: string;
  source: string;
  medium: string;
  sessions: number;
};

type Ga4ReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

function blogPathFilter(pathPrefix = '/articulos/') {
  return {
    filter: {
      fieldName: 'pagePath',
      stringFilter: { matchType: 'BEGINS_WITH', value: pathPrefix },
    },
  };
}

function dateRangeBody(days: number, offsetDays = 0) {
  if (offsetDays === 0) {
    return { startDate: `${days}daysAgo`, endDate: 'today' };
  }
  return {
    startDate: `${offsetDays + days}daysAgo`,
    endDate: `${offsetDays + 1}daysAgo`,
  };
}

/** Fixed offsets: current period ends today; previous period ends `days` ago. */
function periodDateRanges(days: number) {
  return [
    { startDate: `${days}daysAgo`, endDate: 'today', name: 'current' },
    { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
  ];
}

async function runGa4Report(
  config: GoogleMetricsConfig,
  body: Record<string, unknown>,
): Promise<Ga4ReportResponse> {
  const propertyId = config.ga4PropertyId;
  return googleFetch<Ga4ReportResponse>(
    config,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      scopes: GA4_SCOPES,
    },
  );
}

export async function fetchGa4PageSessions(
  config: GoogleMetricsConfig,
  options?: { days?: number; pathPrefix?: string },
): Promise<Ga4PageRow[]> {
  const pathPrefix = options?.pathPrefix ?? '/articulos/';

  const body: Record<string, unknown> = {
    dateRanges: [dateRangeBody(options?.days ?? 28)],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: blogPathFilter(pathPrefix),
    limit: 10000,
  };

  const data = await runGa4Report(config, body);

  return (data.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function fetchGa4DailySessions(
  config: GoogleMetricsConfig,
  options?: { days?: number; pathPrefix?: string },
): Promise<Ga4DailyRow[]> {
  const pathPrefix = options?.pathPrefix ?? '/articulos/';

  const body: Record<string, unknown> = {
    dateRanges: [dateRangeBody(options?.days ?? 30)],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: blogPathFilter(pathPrefix),
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 10000,
  };

  const data = await runGa4Report(config, body);

  return (data.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? '',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function fetchGa4DailySessionsBySource(
  config: GoogleMetricsConfig,
  options?: { days?: number; pathPrefix?: string },
): Promise<Ga4DailySourceRow[]> {
  const pathPrefix = options?.pathPrefix ?? '/articulos/';

  const body: Record<string, unknown> = {
    dateRanges: [dateRangeBody(options?.days ?? 30)],
    dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: blogPathFilter(pathPrefix),
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 25000,
  };

  const data = await runGa4Report(config, body);

  return (data.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? '',
    source: row.dimensionValues?.[1]?.value ?? '(not set)',
    medium: row.dimensionValues?.[2]?.value ?? '(not set)',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function fetchGa4SessionsBySource(
  config: GoogleMetricsConfig,
  options?: { days?: number; pathPrefix?: string; offsetDays?: number },
): Promise<Ga4SourceRow[]> {
  const pathPrefix = options?.pathPrefix ?? '/articulos/';
  const days = options?.days ?? 30;

  const body: Record<string, unknown> = {
    dateRanges: [dateRangeBody(days, options?.offsetDays ?? 0)],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: blogPathFilter(pathPrefix),
    limit: 10000,
  };

  const data = await runGa4Report(config, body);

  return (data.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? '(not set)',
    medium: row.dimensionValues?.[1]?.value ?? '(not set)',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function fetchGa4BlogSessionTotals(
  config: GoogleMetricsConfig,
  days: number,
): Promise<{ current: number; previous: number }> {
  const body: Record<string, unknown> = {
    dateRanges: periodDateRanges(days),
    metrics: [{ name: 'sessions' }],
    dimensionFilter: blogPathFilter('/articulos/'),
  };

  const data = await runGa4Report(config, body);
  const row = data.rows?.[0];
  return {
    current: Number(row?.metricValues?.[0]?.value ?? 0),
    previous: Number(row?.metricValues?.[1]?.value ?? 0),
  };
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
