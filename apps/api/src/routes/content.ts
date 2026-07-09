import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

const contentRoutes: FastifyPluginAsync = async (server) => {
  server.get('/pieces', async (request) => {
    const { workspace: workspaceSlug, status } = request.query as {
      workspace?: string;
      status?: string;
    };

    const pieces = await prisma.contentPiece.findMany({
      where: {
        ...(workspaceSlug ? { workspace: { slug: workspaceSlug } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        approval: true,
        publication: true,
        mission: {
          select: {
            id: true,
            title: true,
            trigger: true,
            agent: { select: { slug: true, name: true } },
          },
        },
      },
    });

    return { pieces };
  });
};

export default contentRoutes;
