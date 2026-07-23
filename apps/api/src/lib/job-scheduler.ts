import { prisma } from './prisma';
import { queueMissionExecution } from './mission-executor';
import { frequencyToIntervalDays } from './frequency';

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
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

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

  setTimeout(tick, 30_000);
  setInterval(tick, intervalMs);

  console.log(`[scheduler] Autonomía Teo activa — tick cada ${intervalMs / 1000}s`);
}
