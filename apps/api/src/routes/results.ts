import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

const resultsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }

    const [
      publications,
      piecesByStatus,
      recentMetrics,
      completedMissions,
      pendingApprovals,
    ] = await Promise.all([
      prisma.publication.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { publishedAt: 'desc' },
        take: 20,
        include: { piece: { select: { title: true, slug: true, type: true } } },
      }),
      prisma.contentPiece.groupBy({
        by: ['status'],
        where: { workspaceId: workspace.id },
        _count: true,
      }),
      prisma.metricSnapshot.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { capturedAt: 'desc' },
        take: 50,
      }),
      prisma.mission.count({
        where: { workspaceId: workspace.id, status: 'completed' },
      }),
      prisma.approval.count({
        where: { workspaceId: workspace.id, status: 'pending' },
      }),
    ]);

    const totalImpressions = recentMetrics
      .filter((m) => m.source === 'gsc')
      .reduce((sum, m) => sum + (m.impressions ?? 0), 0);

    const totalSessions = recentMetrics
      .filter((m) => m.source === 'ga4')
      .reduce((sum, m) => sum + (m.sessions ?? 0), 0);

    const topUrls = Object.values(
      recentMetrics.reduce<Record<string, { url: string; impressions: number; clicks: number; sessions: number }>>(
        (acc, row) => {
          if (!acc[row.url]) {
            acc[row.url] = { url: row.url, impressions: 0, clicks: 0, sessions: 0 };
          }
          acc[row.url].impressions += row.impressions ?? 0;
          acc[row.url].clicks += row.clicks ?? 0;
          acc[row.url].sessions += row.sessions ?? 0;
          return acc;
        },
        {},
      ),
    )
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      summary: {
        publications: publications.length,
        completedMissions,
        pendingApprovals,
        totalImpressions,
        totalSessions,
      },
      piecesByStatus: piecesByStatus.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      topUrls,
      recentPublications: publications,
    };
  });
};

export default resultsRoutes;
