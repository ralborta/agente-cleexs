import { prisma } from './prisma';
import { frequencyToIntervalDays } from './frequency';

export async function getAutomationStatus(workspaceSlug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      agentConfigs: {
        include: { agent: { select: { slug: true, name: true } } },
      },
    },
  });

  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const teoConfig = workspace.agentConfigs.find((c) => c.agent.slug === 'teo');
  const intervalDays = frequencyToIntervalDays(teoConfig?.frequency);

  const [activeMissions, lastMission, lastMetric] = await Promise.all([
    prisma.mission.count({
      where: {
        workspaceId: workspace.id,
        status: { in: ['pending', 'in_progress'] },
      },
    }),
    prisma.mission.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, trigger: true, createdAt: true },
    }),
    prisma.metricSnapshot.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    }),
  ]);

  const schedulerEnabled = process.env.DISABLE_AUTONOMOUS !== 'true';
  const msSinceLastMission = lastMission
    ? Date.now() - lastMission.createdAt.getTime()
    : null;
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const eligibleForNext =
    schedulerEnabled &&
    Boolean(teoConfig?.topics) &&
    activeMissions === 0 &&
    (msSinceLastMission === null || msSinceLastMission >= intervalMs);

  const msUntilNext =
    msSinceLastMission === null
      ? 0
      : Math.max(0, intervalMs - msSinceLastMission);
  const nextEligibleAt =
    eligibleForNext || msSinceLastMission === null
      ? new Date().toISOString()
      : new Date(Date.now() + msUntilNext).toISOString();

  const apiPublicUrl =
    process.env.API_PUBLIC_URL || 'https://agente-cleexs-api.wd75db.easypanel.host';

  return {
    schedulerEnabled,
    tickIntervalMs: Number(process.env.AUTONOMOUS_TICK_MS || 60 * 60 * 1000),
    intervalDays,
    frequency: teoConfig?.frequency ?? null,
    autoPublish: teoConfig?.autoPublish ?? false,
    topicsConfigured: Array.isArray(teoConfig?.topics) && (teoConfig.topics as string[]).length > 0,
    activeMissions,
    eligibleForNext,
    nextEligibleAt,
    hoursUntilNext: Math.ceil(msUntilNext / (60 * 60 * 1000)),
    cronBackup: {
      apiBaseUrl: apiPublicUrl,
      autonomousTick: `${apiPublicUrl}/api/cron/autonomous-tick`,
      metricsSync: `${apiPublicUrl}/api/cron/metrics-sync`,
      refresherScan: `${apiPublicUrl}/api/cron/refresher-scan`,
      header: 'x-cron-secret',
    },
    lastMission: lastMission
      ? {
          id: lastMission.id,
          title: lastMission.title,
          status: lastMission.status,
          trigger: lastMission.trigger,
          createdAt: lastMission.createdAt.toISOString(),
        }
      : null,
    lastMetricsSync: lastMetric?.capturedAt.toISOString() ?? null,
  };
}
