import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  createAndProcessFromPiece,
  ensureCreativeTemplatesSynced,
  listTemplateConfigs,
  processCreativeRequest,
} from '../lib/agents/growth';
import { resolveAssetAbsolutePath } from '../lib/agents/growth/creative/render';

async function assertWorkspaceAccess(
  request: { authUser?: { workspaceId: string; role: string } | null },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  workspaceSlug: string,
) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    reply.status(404).send({ error: 'Workspace no encontrado' });
    return null;
  }
  if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
    reply.status(403).send({ error: 'Sin acceso a este workspace' });
    return null;
  }
  return workspace;
}

const growthRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/creative/templates', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    await ensureCreativeTemplatesSynced();
    return { workspace: workspaceSlug, templates: listTemplateConfigs() };
  });

  server.get('/:workspaceSlug/creative/requests', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const rows = await prisma.creativeRequest.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        piece: { select: { id: true, title: true, slug: true } },
        assets: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            templateKey: true,
            templateVersion: true,
            mimeType: true,
            width: true,
            height: true,
            format: true,
            createdAt: true,
          },
        },
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, channel: true },
        },
      },
    });

    return { workspace: workspaceSlug, requests: rows };
  });

  server.get('/:workspaceSlug/creative/requests/:id', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const row = await prisma.creativeRequest.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        piece: true,
        publication: true,
        assets: { orderBy: { createdAt: 'desc' } },
        posts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) return reply.status(404).send({ error: 'Request no encontrado' });
    return { workspace: workspaceSlug, request: row };
  });

  server.post('/:workspaceSlug/creative/from-piece/:pieceId', async (request, reply) => {
    const { workspaceSlug, pieceId } = request.params as {
      workspaceSlug: string;
      pieceId: string;
    };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!request.authUser || !['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    const piece = await prisma.contentPiece.findFirst({
      where: { id: pieceId, workspaceId: workspace.id },
    });
    if (!piece) return reply.status(404).send({ error: 'Pieza no encontrada' });

    try {
      const result = await createAndProcessFromPiece({
        workspaceId: workspace.id,
        pieceId: piece.id,
      });
      return { workspace: workspaceSlug, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error Creative Engine';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/creative/requests/:id/reprocess', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!request.authUser || !['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    const existing = await prisma.creativeRequest.findFirst({
      where: { id, workspaceId: workspace.id },
    });
    if (!existing) return reply.status(404).send({ error: 'Request no encontrado' });

    try {
      const result = await processCreativeRequest(id);
      return { workspace: workspaceSlug, requestId: id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al reprocesar';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/creative/requests/:id/approve', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!request.authUser || !['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    const body = z
      .object({
        caption: z.string().max(3000).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: 'Datos inválidos' });

    const existing = await prisma.creativeRequest.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { posts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!existing) return reply.status(404).send({ error: 'Request no encontrado' });
    if (existing.status !== 'preview' && existing.status !== 'approved') {
      return reply.status(409).send({ error: 'Solo se pueden aprobar requests en preview' });
    }

    await prisma.creativeRequest.update({
      where: { id },
      data: { status: 'approved' },
    });

    const post = existing.posts[0];
    if (post) {
      await prisma.distributionPost.update({
        where: { id: post.id },
        data: {
          status: 'draft',
          caption: body.data.caption ?? post.caption,
        },
      });
    }

    return {
      workspace: workspaceSlug,
      requestId: id,
      status: 'approved',
      note: 'Listo para LinkedIn Publisher (post-V1). Guardado como DistributionPost draft.',
    };
  });

  server.get('/:workspaceSlug/creative/assets/:assetId', async (request, reply) => {
    const { workspaceSlug, assetId } = request.params as {
      workspaceSlug: string;
      assetId: string;
    };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const asset = await prisma.creativeAsset.findFirst({
      where: { id: assetId, workspaceId: workspace.id },
    });
    if (!asset) return reply.status(404).send({ error: 'Asset no encontrado' });

    const absolute = resolveAssetAbsolutePath(asset.filePath);
    try {
      await access(absolute);
    } catch {
      return reply.status(404).send({ error: 'Archivo de asset no encontrado en disco' });
    }

    reply.header('Content-Type', asset.mimeType);
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(createReadStream(absolute));
  });
};

export default growthRoutes;
