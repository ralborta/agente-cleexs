import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

const centroRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      include: {
        agentConfigs: {
          include: { agent: true },
        },
      },
    });

    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }

    const [
      publishedCount,
      pendingApprovals,
      refreshNeeded,
      activeMissions,
      recentActivity,
      impressions,
    ] = await Promise.all([
      prisma.publication.count({ where: { workspaceId: workspace.id } }),
      prisma.approval.count({
        where: { workspaceId: workspace.id, status: 'pending' },
      }),
      prisma.contentPiece.count({
        where: { workspaceId: workspace.id, status: 'refresh_needed' },
      }),
      prisma.mission.count({
        where: { workspaceId: workspace.id, status: 'in_progress' },
      }),
      prisma.agentActivity.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { agent: { select: { slug: true, name: true } } },
      }),
      prisma.metricSnapshot.aggregate({
        where: { workspaceId: workspace.id, source: 'gsc' },
        _sum: { impressions: true },
      }),
    ]);

    const agentsOnline = workspace.agentConfigs.map((config) => ({
      slug: config.agent.slug,
      name: config.agent.name,
      status: activeMissions > 0 ? 'working' : 'online',
    }));

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      kpis: [
        {
          label: 'Piezas publicadas',
          value: publishedCount,
          hint: 'Total en WordPress',
        },
        {
          label: 'Impresiones Google',
          value: impressions._sum.impressions ?? 0,
          hint: 'Search Console',
          trend: '+18% vs mes anterior',
        },
        {
          label: 'En aprobación',
          value: pendingApprovals,
          hint: 'Pendientes de revisión',
        },
        {
          label: 'A refrescar',
          value: refreshNeeded,
          hint: 'Contenido envejecido',
        },
        {
          label: 'Misiones activas',
          value: activeMissions,
          hint: 'Teo trabajando ahora',
        },
      ],
      agentsOnline,
      activity: recentActivity.map((item) => ({
        id: item.id,
        agent: item.agent.name,
        role: item.role,
        message: item.message,
        level: item.level,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  });
};

export default centroRoutes;
