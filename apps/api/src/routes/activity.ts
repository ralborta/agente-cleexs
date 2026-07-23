import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

const activityRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request, reply) => {
    const { workspace: workspaceSlug, take: takeRaw } = request.query as {
      workspace?: string;
      take?: string;
    };

    if (!workspaceSlug) {
      return reply.status(400).send({ error: 'Query workspace requerido' });
    }

    const take = Math.min(Number(takeRaw ?? 50) || 50, 100);

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }

    const activities = await prisma.agentActivity.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        agent: { select: { slug: true, name: true } },
        mission: { select: { id: true, title: true, status: true } },
      },
    });

    return {
      activities: activities.map((item) => ({
        id: item.id,
        agent: item.agent.name,
        agentSlug: item.agent.slug,
        role: item.role,
        level: item.level,
        message: item.message,
        missionId: item.missionId,
        missionTitle: item.mission?.title ?? null,
        missionStatus: item.mission?.status ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });
};

export default activityRoutes;
