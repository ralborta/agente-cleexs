import { prisma } from './prisma';
import { logAgentActivity } from './agent-helpers';
import { fetchGscPageMetrics } from './integrations/google-gsc';
import {
  getGoogleMetricsStatus,
  isGoogleMetricsConfigured,
  resolveGoogleMetricsConfig,
} from './integrations/google-config';
import { queueMissionExecution } from './mission-executor';
import { buildMissionObjective } from './agents/teo/mission-plan';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PUBLISHED_AGE_DAYS = 14;
const STALE_DAYS = 45;
const IMPRESSION_DROP_RATIO = 0.25;
const MIN_IMPRESSIONS_FOR_DROP = 10;
const REFRESH_MISSION_COOLDOWN_DAYS = 7;
const SCAN_PERIOD_DAYS = 28;

export type RefreshSignal = {
  pieceId: string;
  title: string;
  url: string;
  keyword: string | null;
  pieceType: string;
  reason: string;
  priority: number;
  metrics: {
    impressionsCurrent: number;
    impressionsPrevious: number;
    clicksCurrent: number;
    publishedDays: number;
  };
};

function pathnameOf(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return path || '/';
  } catch {
    return url.replace(/\/$/, '');
  }
}

function matchGscRow(
  rows: Awaited<ReturnType<typeof fetchGscPageMetrics>>,
  publicationUrl: string,
) {
  const target = pathnameOf(publicationUrl);
  return rows.find((row) => pathnameOf(row.url) === target);
}

function evaluateSignals(input: {
  impressionsCurrent: number;
  impressionsPrevious: number;
  clicksCurrent: number;
  publishedDays: number;
}): { match: boolean; reason: string; priority: number } | null {
  const { impressionsCurrent, impressionsPrevious, clicksCurrent, publishedDays } = input;

  if (publishedDays >= STALE_DAYS) {
    return {
      match: true,
      reason: `Contenido con más de ${STALE_DAYS} días sin actualización`,
      priority: 40 + Math.min(publishedDays - STALE_DAYS, 60),
    };
  }

  if (
    impressionsPrevious >= MIN_IMPRESSIONS_FOR_DROP &&
    impressionsCurrent < impressionsPrevious * (1 - IMPRESSION_DROP_RATIO)
  ) {
    const dropPct = Math.round((1 - impressionsCurrent / impressionsPrevious) * 100);
    return {
      match: true,
      reason: `Caída de impresiones Google (${dropPct}% vs período anterior)`,
      priority: 50 + dropPct,
    };
  }

  if (impressionsCurrent >= 30 && clicksCurrent === 0) {
    return {
      match: true,
      reason: `${impressionsCurrent} impresiones en Google sin clicks — mejorar título y contenido`,
      priority: 35 + Math.min(impressionsCurrent, 40),
    };
  }

  if (publishedDays >= MIN_PUBLISHED_AGE_DAYS && impressionsCurrent === 0 && impressionsPrevious === 0) {
    return {
      match: true,
      reason: 'Sin visibilidad en Google tras publicación — oportunidad de refresco SEO',
      priority: 30,
    };
  }

  return null;
}

export async function scanWorkspaceRefreshCandidates(workspaceSlug: string): Promise<{
  workspace: string;
  scanned: number;
  candidates: RefreshSignal[];
  googleConfigured: boolean;
}> {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const config = resolveGoogleMetricsConfig(workspaceSlug);
  const googleConfigured = isGoogleMetricsConfigured(config);

  const publications = await prisma.publication.findMany({
    where: { workspaceId: workspace.id, url: { not: null } },
    include: {
      piece: {
        select: {
          id: true,
          title: true,
          keyword: true,
          type: true,
          status: true,
        },
      },
    },
  });

  let gscCurrent: Awaited<ReturnType<typeof fetchGscPageMetrics>> = [];
  let gscPrevious: Awaited<ReturnType<typeof fetchGscPageMetrics>> = [];

  if (googleConfigured && config) {
    [gscCurrent, gscPrevious] = await Promise.all([
      fetchGscPageMetrics(config, { days: SCAN_PERIOD_DAYS, pageFilter: '/articulos/' }),
      fetchGscPageMetrics(config, {
        days: SCAN_PERIOD_DAYS,
        pageFilter: '/articulos/',
        offsetDays: SCAN_PERIOD_DAYS,
      }),
    ]);
  }

  const candidates: RefreshSignal[] = [];
  const now = Date.now();

  for (const pub of publications) {
    if (!pub.url || !pub.piece) continue;
    if (pub.piece.status === 'archived') continue;

    const publishedAt = pub.publishedAt;
    const publishedDays = publishedAt
      ? Math.floor((now - publishedAt.getTime()) / DAY_MS)
      : MIN_PUBLISHED_AGE_DAYS;

    if (publishedDays < MIN_PUBLISHED_AGE_DAYS) continue;

    const gscNow = matchGscRow(gscCurrent, pub.url);
    const gscBefore = matchGscRow(gscPrevious, pub.url);
    const impressionsCurrent = gscNow?.impressions ?? 0;
    const impressionsPrevious = gscBefore?.impressions ?? 0;
    const clicksCurrent = gscNow?.clicks ?? 0;

    const signal = evaluateSignals({
      impressionsCurrent,
      impressionsPrevious,
      clicksCurrent,
      publishedDays,
    });

    if (!signal) continue;

    candidates.push({
      pieceId: pub.piece.id,
      title: pub.piece.title,
      url: pub.url,
      keyword: pub.piece.keyword,
      pieceType: pub.piece.type,
      reason: signal.reason,
      priority: signal.priority,
      metrics: {
        impressionsCurrent,
        impressionsPrevious,
        clicksCurrent,
        publishedDays,
      },
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);

  return {
    workspace: workspaceSlug,
    scanned: publications.length,
    candidates,
    googleConfigured,
  };
}

export async function applyRefreshScan(workspaceSlug: string) {
  const { candidates, scanned, googleConfigured } = await scanWorkspaceRefreshCandidates(workspaceSlug);
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const candidateIds = new Set(candidates.map((c) => c.pieceId));
  const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });

  const publishedPieces = await prisma.contentPiece.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: ['published', 'refresh_needed'] },
      publication: { isNot: null },
    },
    select: { id: true, status: true },
  });

  let marked = 0;
  let cleared = 0;

  for (const piece of publishedPieces) {
    if (candidateIds.has(piece.id)) {
      if (piece.status !== 'refresh_needed') {
        await prisma.contentPiece.update({
          where: { id: piece.id },
          data: { status: 'refresh_needed' },
        });
        marked += 1;
      }
    } else if (piece.status === 'refresh_needed') {
      await prisma.contentPiece.update({
        where: { id: piece.id },
        data: { status: 'published' },
      });
      cleared += 1;
    }
  }

  if (teo && candidates.length > 0) {
    const top = candidates[0];
    await logAgentActivity({
      workspaceId: workspace.id,
      agentId: teo.id,
      role: 'refresher',
      level: 'warning',
      message: `Refrescador: ${candidates.length} pieza(s) candidata(s). Prioridad: "${top.title}" — ${top.reason}`,
    });
  } else if (teo && scanned > 0) {
    await logAgentActivity({
      workspaceId: workspace.id,
      agentId: teo.id,
      role: 'refresher',
      level: 'info',
      message: `Refrescador: ${scanned} URL(s) analizadas — sin refresco urgente`,
    });
  }

  return {
    workspace: workspaceSlug,
    scanned,
    candidates: candidates.length,
    marked,
    cleared,
    googleConfigured,
    topCandidate: candidates[0] ?? null,
  };
}

export async function spawnRefreshMission(
  workspaceSlug: string,
  candidate?: RefreshSignal,
  options?: { force?: boolean },
) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      agentConfigs: { include: { agent: true } },
    },
  });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const teoConfig = workspace.agentConfigs.find((c) => c.agent.slug === 'teo');
  if (!teoConfig) throw new Error('Agente Teo no configurado');

  const active = await prisma.mission.count({
    where: {
      workspaceId: workspace.id,
      status: { in: ['pending', 'in_progress'] },
    },
  });
  if (active > 0) {
    return { skipped: true, reason: 'mission_active' as const };
  }

  if (!options?.force) {
    const cooldownSince = new Date(Date.now() - REFRESH_MISSION_COOLDOWN_DAYS * DAY_MS);
    const recentRefreshMission = await prisma.mission.findFirst({
      where: {
        workspaceId: workspace.id,
        trigger: 'refresh_scan',
        createdAt: { gte: cooldownSince },
        status: { in: ['pending', 'in_progress', 'completed'] },
      },
    });
    if (recentRefreshMission) {
      return { skipped: true, reason: 'cooldown' as const };
    }
  }

  let target = candidate;
  if (!target) {
    const scan = await scanWorkspaceRefreshCandidates(workspaceSlug);
    target = scan.candidates[0];
  }
  if (!target) {
    return { skipped: true, reason: 'no_candidates' as const };
  }

  const topic = target.keyword?.trim() || target.title;
  const objective = buildMissionObjective(
    `Refrescar artículo publicado (${target.reason}). Mantener URL: ${target.url}. [refreshPieceId:${target.pieceId}]`,
    { topic, pieceType: target.pieceType, depth: 'pro' },
  );

  const mission = await prisma.mission.create({
    data: {
      workspaceId: workspace.id,
      agentId: teoConfig.agentId,
      title: `Refresco: ${target.title}`,
      objective,
      status: 'pending',
      trigger: 'refresh_scan',
    },
  });

  await logAgentActivity({
    workspaceId: workspace.id,
    agentId: teoConfig.agentId,
    missionId: mission.id,
    role: 'refresher',
    level: 'info',
    message: `Misión de refresco encolada para "${target.title}"`,
  });

  queueMissionExecution(mission.id);

  return { skipped: false, missionId: mission.id, candidate: target };
}

export async function tickRefresherScans() {
  const workspaces = await prisma.workspace.findMany({ select: { slug: true } });
  const results: Array<Awaited<ReturnType<typeof applyRefreshScan>> & { spawned?: boolean }> = [];

  for (const workspace of workspaces) {
    try {
      const scanResult = await applyRefreshScan(workspace.slug);
      let spawned = false;

      if (scanResult.candidates > 0) {
        const spawn = await spawnRefreshMission(workspace.slug, scanResult.topCandidate ?? undefined);
        spawned = !spawn.skipped;
      }

      results.push({ ...scanResult, spawned });
    } catch (err) {
      console.error(`[refresher] Error en ${workspace.slug}:`, err);
    }
  }

  return {
    workspaces: results.length,
    candidates: results.reduce((s, r) => s + r.candidates, 0),
    missionsSpawned: results.filter((r) => r.spawned).length,
    results,
  };
}

export function getRefresherStatus(workspaceSlug: string) {
  return {
    configured: getGoogleMetricsStatus(workspaceSlug).configured,
    minPublishedAgeDays: MIN_PUBLISHED_AGE_DAYS,
    staleDays: STALE_DAYS,
    missionCooldownDays: REFRESH_MISSION_COOLDOWN_DAYS,
  };
}

function parseRefreshReasonFromObjective(objective: string): string | null {
  const match = objective.match(/Refrescar artículo publicado \((.+?)\)\./);
  return match?.[1] ?? null;
}

function refreshPieceIdFromObjective(objective: string): string | null {
  const match = objective.match(/\[refreshPieceId:([^\]]+)\]/);
  return match?.[1] ?? null;
}

export type RefreshPieceMeta = {
  reason: string | null;
  lastMission: { id: string; status: string; createdAt: string } | null;
};

export async function getRefreshPiecesMeta(
  workspaceSlug: string,
  pieceIds: string[],
): Promise<Record<string, RefreshPieceMeta>> {
  if (pieceIds.length === 0) return {};

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) return {};

  const missions = await prisma.mission.findMany({
    where: {
      workspaceId: workspace.id,
      trigger: 'refresh_scan',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, objective: true, createdAt: true },
  });

  let candidateReasons = new Map<string, string>();
  try {
    const scan = await scanWorkspaceRefreshCandidates(workspaceSlug);
    candidateReasons = new Map(scan.candidates.map((c) => [c.pieceId, c.reason]));
  } catch {
    // GSC no disponible — usamos motivo de misión previa si existe
  }

  const meta: Record<string, RefreshPieceMeta> = {};

  for (const pieceId of pieceIds) {
    const lastMission = missions.find(
      (m) => m.objective && refreshPieceIdFromObjective(m.objective) === pieceId,
    );
    const reasonFromMission =
      lastMission?.objective ? parseRefreshReasonFromObjective(lastMission.objective) : null;

    meta[pieceId] = {
      reason: candidateReasons.get(pieceId) ?? reasonFromMission,
      lastMission: lastMission
        ? {
            id: lastMission.id,
            status: lastMission.status,
            createdAt: lastMission.createdAt.toISOString(),
          }
        : null,
    };
  }

  return meta;
}

export async function retryRefreshMissionForPiece(workspaceSlug: string, pieceId: string) {
  const scan = await scanWorkspaceRefreshCandidates(workspaceSlug);
  let candidate = scan.candidates.find((c) => c.pieceId === pieceId);

  if (!candidate) {
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

    const piece = await prisma.contentPiece.findFirst({
      where: { id: pieceId, workspaceId: workspace.id, status: 'refresh_needed' },
      include: { publication: true },
    });
    if (!piece?.publication?.url) {
      throw new Error('Pieza no encontrada o sin URL publicada');
    }

    candidate = {
      pieceId: piece.id,
      title: piece.title,
      url: piece.publication.url,
      keyword: piece.keyword,
      pieceType: piece.type,
      reason: 'Reintento manual de refresco',
      priority: 100,
      metrics: {
        impressionsCurrent: 0,
        impressionsPrevious: 0,
        clicksCurrent: 0,
        publishedDays: MIN_PUBLISHED_AGE_DAYS,
      },
    };
  }

  return spawnRefreshMission(workspaceSlug, candidate, { force: true });
}
