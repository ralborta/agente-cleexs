import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  bootstrapClusterAssignments,
  listWorkspaceClusters,
} from '../lib/content-cluster';
import { rerenderPieceFromArticleData } from '../lib/piece-editor';
import { resyncPublishedPieceToWordPress } from '../lib/integrations/wordpress-publish';

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

  /** Re-aplica el diseño actual al HTML de una pieza (sin regenerar el contenido). */
  server.post('/pieces/:id/rerender', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { resync } = (request.body as { resync?: boolean }) ?? {};
    const authUser = request.authUser;

    if (!authUser || !['admin', 'editor'].includes(authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    try {
      const piece = await rerenderPieceFromArticleData(id, { workspaceId: authUser.workspaceId });

      let publication: { url: string; status: string } | null = null;
      if (resync) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: authUser.workspaceId },
          select: { slug: true },
        });
        if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
        const result = await resyncPublishedPieceToWordPress(workspace.slug, piece.id);
        publication = { url: result.url, status: result.status };
      }

      return {
        ok: true,
        piece: { id: piece.id, title: piece.title, status: piece.status },
        publication,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al re-renderizar';
      const status = message.includes('no encontrada')
        ? 404
        : message.includes('no pertenece')
          ? 403
          : 409;
      return reply.status(status).send({ error: message });
    }
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
