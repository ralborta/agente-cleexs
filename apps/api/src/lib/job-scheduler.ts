import { prisma } from './prisma';
import { queueMissionExecution } from './mission-executor';
import { frequencyToIntervalDays } from './frequency';
import { syncWorkspaceMetrics } from './metrics-sync';
import { tickRefresherScans } from './refresher-scan';
import { getStrategicPlanHints } from './agents/teo/strategist-metrics';
import { tickOpportunityCloud } from './agents/teo/keyword-opportunities';
import { buildMissionObjective } from './agents/teo/mission-plan';
import { logAgentActivity } from './agent-helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function tickMetricsSync() {
  const workspaces = await prisma.workspace.findMany({ select: { slug: true, id: true } });
  const synced: string[] = [];

  for (const workspace of workspaces) {
    const lastSnapshot = await prisma.metricSnapshot.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true },
    });

    const elapsed = lastSnapshot ? Date.now() - lastSnapshot.capturedAt.getTime() : DAY_MS + 1;
    if (elapsed < DAY_MS) continue;

    try {
      const result = await syncWorkspaceMetrics(workspace.slug);
      if (!result.skipped) {
        synced.push(workspace.slug);
        console.log(`[scheduler] Métricas sincronizadas: ${workspace.slug}`);
      }
    } catch (err) {
      console.error(`[scheduler] Error sync métricas ${workspace.slug}:`, err);
    }
  }

  return { synced: synced.length, workspaces: synced };
}

export async function tickAutonomousMissions() {
  const workspaces = await prisma.workspace.findMany({
    include: {
      agentConfigs: {
        include: { agent: true },
      },
    },
  });

  const spawned: string[] = [];

  for (const workspace of workspaces) {
    const teoConfig = workspace.agentConfigs.find((c) => c.agent.slug === 'teo');
    if (!teoConfig) continue;

    const topics = teoConfig.topics as string[] | null;
    if (!topics || topics.length === 0) continue;

    const intervalDays = frequencyToIntervalDays(teoConfig.frequency);
    const intervalMs = intervalDays * DAY_MS;

    const active = await prisma.mission.count({
      where: {
        workspaceId: workspace.id,
        status: { in: ['pending', 'in_progress'] },
      },
    });
    if (active > 0) continue;

    const lastMission = await prisma.mission.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
    });

    if (lastMission && Date.now() - lastMission.createdAt.getTime() < intervalMs) {
      continue;
    }

    const missionCount = await prisma.mission.count({
      where: { workspaceId: workspace.id },
    });

    const hints = await getStrategicPlanHints(
      workspace.slug,
      { topics: teoConfig.topics as string[] | null },
      missionCount,
    );
    const objective = buildMissionObjective(hints.objective, {
      topic: hints.topic,
      pieceType: hints.pieceType,
      depth: hints.depth,
    });

    const mission = await prisma.mission.create({
      data: {
        workspaceId: workspace.id,
        agentId: teoConfig.agentId,
        title: `Misión autónoma: ${hints.title ?? hints.topic ?? 'contenido'}`,
        objective: objective ?? `Producir contenido sobre "${hints.topic}" impulsado por métricas.`,
        status: 'pending',
        trigger: 'scheduled',
      },
    });

    if (hints.rationale) {
      await logAgentActivity({
        workspaceId: workspace.id,
        agentId: teoConfig.agentId,
        missionId: mission.id,
        role: 'strategist',
        message: `Misión autónoma planificada — ${hints.rationale}`,
      });
    }

    queueMissionExecution(mission.id);
    spawned.push(mission.id);
  }

  return { spawned: spawned.length, missionIds: spawned };
}

export async function runSchedulerTick() {
  const opportunities = await tickOpportunityCloud();
  const metrics = await tickMetricsSync();
  const refresher = await tickRefresherScans();
  const missions = await tickAutonomousMissions();
  return { opportunities, missions, metrics, refresher };
}

export function startAutonomousScheduler() {
  const intervalMs = Number(process.env.AUTONOMOUS_TICK_MS || 60 * 60 * 1000);

  const tick = () => {
    runSchedulerTick()
      .then(({ opportunities, missions, metrics, refresher }) => {
        if (opportunities.created > 0) {
          console.log(
            `[scheduler] Cloud oportunidades: +${opportunities.created} en ${opportunities.workspaces} workspace(s)`,
          );
        }
        if (missions.spawned > 0) {
          console.log(`[scheduler] Misiones autónomas disparadas: ${missions.spawned}`);
        }
        if (metrics.synced > 0) {
          console.log(`[scheduler] Sync métricas: ${metrics.synced} workspace(s)`);
        }
        if (refresher.missionsSpawned > 0) {
          console.log(`[scheduler] Misiones refresco: ${refresher.missionsSpawned}`);
        }
      })
      .catch((err) => console.error('[scheduler] Error:', err));
  };

  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);

  console.log(`[scheduler] Autonomía + métricas activas — tick cada ${intervalMs / 1000}s`);
}
