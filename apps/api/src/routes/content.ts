import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  bootstrapClusterAssignments,
  listWorkspaceClusters,
} from '../lib/content-cluster';

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
        cluster: { select: { id: true, name: true } },
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

  server.get('/clusters', async (request, reply) => {
    const { workspace: workspaceSlug } = request.query as { workspace?: string };
    if (!workspaceSlug) {
      return reply.status(400).send({ error: 'workspace requerido' });
    }
    try {
      const clusters = await listWorkspaceClusters(workspaceSlug);
      return { workspace: workspaceSlug, clusters };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al listar ecosistemas';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/clusters/bootstrap', async (request, reply) => {
    const { workspace: workspaceSlug } = (request.body as { workspace?: string }) ?? {};
    if (!workspaceSlug) {
      return reply.status(400).send({ error: 'workspace requerido' });
    }
    try {
      const result = await bootstrapClusterAssignments(workspaceSlug);
      const clusters = await listWorkspaceClusters(workspaceSlug);
      return { workspace: workspaceSlug, ...result, clusters };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al bootstrap ecosistema';
      return reply.status(502).send({ error: message });
    }
  });
};

export default contentRoutes;
