import { prisma } from './prisma';
import { fetchGa4PageSessions, testGa4Connection } from './integrations/google-ga4';
import { fetchGscPageMetrics, testGscConnection } from './integrations/google-gsc';
import {
  getGoogleMetricsStatus,
  hasGa4Configured,
  isGoogleMetricsConfigured,
  resolveGoogleMetricsConfig,
} from './integrations/google-config';

function pathnameOf(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return url.replace(/\/$/, '');
  }
}

function matchGscRow(rows: Awaited<ReturnType<typeof fetchGscPageMetrics>>, publicationUrl: string) {
  const target = pathnameOf(publicationUrl);
  return rows.find((row) => pathnameOf(row.url) === target);
}

function matchGa4Row(rows: Awaited<ReturnType<typeof fetchGa4PageSessions>>, publicationUrl: string) {
  const target = pathnameOf(publicationUrl);
  return rows.find((row) => row.path.replace(/\/$/, '') === target);
}

export async function syncWorkspaceMetrics(workspaceSlug: string) {
  const config = resolveGoogleMetricsConfig(workspaceSlug);
  if (!isGoogleMetricsConfigured(config)) {
    return {
      skipped: true,
      reason: 'google_not_configured',
      status: getGoogleMetricsStatus(workspaceSlug),
    };
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const publications = await prisma.publication.findMany({
    where: { workspaceId: workspace.id, url: { not: null } },
    select: { url: true, pieceId: true },
  });

  if (publications.length === 0) {
    return { ok: true, workspace: workspaceSlug, synced: 0, message: 'Sin publicaciones con URL' };
  }

  const [gscRows, ga4Rows] = await Promise.all([
    fetchGscPageMetrics(config, { days: 28, pageFilter: '/articulos/' }),
    hasGa4Configured(config)
      ? fetchGa4PageSessions(config, { days: 28, pathPrefix: '/articulos/' })
      : Promise.resolve([]),
  ]);

  const capturedAt = new Date();
  const startOfDay = new Date(capturedAt);
  startOfDay.setUTCHours(0, 0, 0, 0);

  await prisma.metricSnapshot.deleteMany({
    where: {
      workspaceId: workspace.id,
      capturedAt: { gte: startOfDay },
    },
  });

  const snapshots: Array<{
    workspaceId: string;
    url: string;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    sessions: number | null;
    source: string;
    capturedAt: Date;
  }> = [];

  for (const pub of publications) {
    if (!pub.url) continue;
    const gsc = matchGscRow(gscRows, pub.url);
    const ga4 = matchGa4Row(ga4Rows, pub.url);

    if (gsc) {
      snapshots.push({
        workspaceId: workspace.id,
        url: pub.url,
        impressions: gsc.impressions,
        clicks: gsc.clicks,
        ctr: gsc.ctr,
        sessions: null,
        source: 'gsc',
        capturedAt,
      });
    }

    if (ga4) {
      snapshots.push({
        workspaceId: workspace.id,
        url: pub.url,
        impressions: null,
        clicks: null,
        ctr: null,
        sessions: ga4.sessions,
        source: 'ga4',
        capturedAt,
      });
    }
  }

  if (snapshots.length > 0) {
    await prisma.metricSnapshot.createMany({ data: snapshots });
  }

  await prisma.integration.upsert({
    where: {
      workspaceId_type: { workspaceId: workspace.id, type: 'google_search_console' },
    },
    create: {
      workspaceId: workspace.id,
      type: 'google_search_console',
      status: 'connected',
      config: { siteUrl: config.gscSiteUrl },
    },
    update: { status: 'connected', config: { siteUrl: config.gscSiteUrl } },
  });

  if (hasGa4Configured(config)) {
    await prisma.integration.upsert({
      where: {
        workspaceId_type: { workspaceId: workspace.id, type: 'google_analytics' },
      },
      create: {
        workspaceId: workspace.id,
        type: 'google_analytics',
        status: 'connected',
        config: { propertyId: config.ga4PropertyId },
      },
      update: { status: 'connected', config: { propertyId: config.ga4PropertyId } },
    });
  }

  const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });
  if (teo) {
    await prisma.agentActivity.create({
      data: {
        workspaceId: workspace.id,
        agentId: teo.id,
        role: 'publisher',
        level: 'info',
        message: `Sync Google: ${snapshots.filter((s) => s.source === 'gsc').length} URLs GSC, ${snapshots.filter((s) => s.source === 'ga4').length} URLs GA4`,
      },
    });
  }

  return {
    ok: true,
    workspace: workspaceSlug,
    publications: publications.length,
    gscPagesFetched: gscRows.length,
    ga4PagesFetched: ga4Rows.length,
    snapshotsWritten: snapshots.length,
    capturedAt: capturedAt.toISOString(),
  };
}

export async function testGoogleMetrics(workspaceSlug: string) {
  const config = resolveGoogleMetricsConfig(workspaceSlug);
  if (!isGoogleMetricsConfigured(config)) {
    return { configured: false, connected: false, error: 'Credenciales Google no configuradas' };
  }

  const status = getGoogleMetricsStatus(workspaceSlug);
  const results: Record<string, unknown> = { configured: true, status };

  try {
    results.gsc = await testGscConnection(config);
  } catch (err) {
    results.gsc = {
      ok: false,
      error: err instanceof Error ? err.message : 'Error GSC',
    };
  }

  try {
    if (hasGa4Configured(config)) {
      results.ga4 = await testGa4Connection(config);
    } else {
      results.ga4 = { ok: false, skipped: true, error: 'GA4_PROPERTY_ID no configurado' };
    }
  } catch (err) {
    results.ga4 = {
      ok: false,
      error: err instanceof Error ? err.message : 'Error GA4',
    };
  }

  results.connected = Boolean((results.gsc as { ok?: boolean })?.ok);
  if (hasGa4Configured(config)) {
    results.connected = results.connected && Boolean((results.ga4 as { ok?: boolean })?.ok);
  }

  return results;
}
