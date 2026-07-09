import { prisma } from './prisma';
import { queueMissionExecution } from './mission-executor';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Intervalo mínimo entre misiones autónomas por workspace (MVP). */
const MIN_DAYS_BETWEEN_MISSIONS = 3;

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

    if (
      lastMission &&
      Date.now() - lastMission.createdAt.getTime() < MIN_DAYS_BETWEEN_MISSIONS * DAY_MS
    ) {
      continue;
    }

    const topic = topics[Math.floor(Math.random() * topics.length)];
    const mission = await prisma.mission.create({
      data: {
        workspaceId: workspace.id,
        agentId: teoConfig.agentId,
        title: `Misión autónoma: ${topic}`,
        objective: `Producir contenido sobre "${topic}" de forma autónoma.`,
        status: 'pending',
        trigger: 'scheduled',
      },
    });

    queueMissionExecution(mission.id);
    spawned.push(mission.id);
  }

  return { spawned: spawned.length, missionIds: spawned };
}

export function startAutonomousScheduler() {
  const intervalMs = Number(process.env.AUTONOMOUS_TICK_MS || 60 * 60 * 1000);

  const tick = () => {
    tickAutonomousMissions()
      .then((result) => {
        if (result.spawned > 0) {
          console.log(`[scheduler] Misiones autónomas disparadas: ${result.spawned}`);
        }
      })
      .catch((err) => console.error('[scheduler] Error:', err));
  };

  // Primer tick 30s después del arranque (dar tiempo a DB)
  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);

  console.log(`[scheduler] Autonomía Teo activa — tick cada ${intervalMs / 1000}s`);
}
