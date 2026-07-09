import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

type RadarStatus = 'published' | 'approval' | 'working' | 'refresh';
type RadarImpact = 'alto' | 'medio' | 'bajo';

function mapPieceToRadarStatus(status: string): RadarStatus {
  switch (status) {
    case 'published':
      return 'published';
    case 'pending_approval':
    case 'approved':
      return 'approval';
    case 'refresh_needed':
      return 'refresh';
    default:
      return 'working';
  }
}

function mapTypeToImpact(type: string): RadarImpact {
  switch (type) {
    case 'pillar':
    case 'comparison':
    case 'landing':
      return 'alto';
    case 'faq':
    case 'checklist':
    case 'how_to':
    case 'case_study':
      return 'medio';
    default:
      return 'bajo';
  }
}

const RADAR_DISPLAY_ORDER: Record<string, number> = {
  pending_approval: 0,
  approved: 1,
  draft: 2,
  idea: 3,
  refresh_needed: 4,
  published: 5,
};

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
      contentPieces,
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
      prisma.contentPiece.findMany({
        where: { workspaceId: workspace.id, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, type: true, status: true, updatedAt: true },
      }),
    ]);

    const teoConfig = workspace.agentConfigs.find((c) => c.agent.slug === 'teo');
    const teoAgent = teoConfig?.agent;
    const agentWorking = activeMissions > 0;

    const radarPiecesSorted = [...contentPieces].sort(
      (a, b) =>
        (RADAR_DISPLAY_ORDER[a.status] ?? 99) - (RADAR_DISPLAY_ORDER[b.status] ?? 99) ||
        b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    const radarPieces = radarPiecesSorted.slice(0, 6).map((piece) => ({
      id: piece.id,
      title: piece.title,
      type: piece.type,
      status: mapPieceToRadarStatus(piece.status),
      impact: mapTypeToImpact(piece.type),
    }));

    const radarStats = {
      active: contentPieces.length,
      published: contentPieces.filter((p) => p.status === 'published').length,
      approval: contentPieces.filter((p) =>
        ['pending_approval', 'approved'].includes(p.status),
      ).length,
      working: contentPieces.filter((p) => ['draft', 'idea'].includes(p.status)).length,
      refresh: contentPieces.filter((p) => p.status === 'refresh_needed').length,
    };

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
      contentRadar: {
        agentName: teoAgent?.name ?? 'Teo',
        agentActive: Boolean(teoAgent),
        agentWorking,
        pieces: radarPieces,
        stats: radarStats,
      },
    };
  });
};

export default centroRoutes;
