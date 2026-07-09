import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logAgentActivity } from '../lib/agent-helpers';
import { publishPieceToWordPress } from '../lib/integrations/wordpress-publish';

const reviewSchema = z.object({
  notes: z.string().optional(),
  /** draft | publish — override del env al aprobar */
  wpStatus: z.enum(['draft', 'publish']).optional(),
});

const approvalRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request) => {
    const { workspace: workspaceSlug, status } = request.query as {
      workspace?: string;
      status?: string;
    };

    const approvals = await prisma.approval.findMany({
      where: {
        ...(workspaceSlug ? { workspace: { slug: workspaceSlug } } : {}),
        ...(status ? { status: status as never } : { status: 'pending' }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        piece: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return { approvals, pendingCount: approvals.filter((a) => a.status === 'pending').length };
  });

  server.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        piece: { include: { publication: true } },
        workspace: true,
      },
    });
    if (!approval) {
      return reply.status(404).send({ error: 'Aprobación no encontrada' });
    }
    if (approval.status !== 'pending') {
      return reply.status(409).send({ error: 'Esta aprobación ya fue procesada' });
    }

    let wpResult: { externalId: string; url: string; status: string };
    try {
      wpResult = await publishPieceToWordPress(
        approval.workspace.slug,
        approval.piece,
        { status: parsed.data.wpStatus },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar en WordPress';
      return reply.status(502).send({
        error: 'No se pudo publicar en WordPress',
        detail: message,
      });
    }

    await prisma.$transaction([
      prisma.approval.update({
        where: { id },
        data: {
          status: 'approved',
          notes: parsed.data.notes,
          reviewedAt: new Date(),
        },
      }),
      prisma.contentPiece.update({
        where: { id: approval.pieceId },
        data: { status: 'published' },
      }),
      prisma.publication.upsert({
        where: { pieceId: approval.pieceId },
        create: {
          workspaceId: approval.workspaceId,
          pieceId: approval.pieceId,
          externalId: wpResult.externalId,
          url: wpResult.url,
          publishedAt: new Date(),
        },
        update: {
          externalId: wpResult.externalId,
          url: wpResult.url,
          publishedAt: new Date(),
        },
      }),
    ]);

    const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });
    if (teo) {
      await logAgentActivity({
        workspaceId: approval.workspaceId,
        agentId: teo.id,
        role: 'publisher',
        level: 'success',
        message: `"${approval.piece.title}" publicada en WordPress (${wpResult.status}) — ${wpResult.url}`,
      });
    }

    return {
      ok: true,
      pieceId: approval.pieceId,
      wordpress: wpResult,
    };
  });

  server.post('/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reviewSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: { piece: true },
    });
    if (!approval) {
      return reply.status(404).send({ error: 'Aprobación no encontrada' });
    }

    await prisma.$transaction([
      prisma.approval.update({
        where: { id },
        data: {
          status: 'rejected',
          notes: parsed.data.notes,
          reviewedAt: new Date(),
        },
      }),
      prisma.contentPiece.update({
        where: { id: approval.pieceId },
        data: { status: 'archived' },
      }),
    ]);

    return { ok: true };
  });
};

export default approvalRoutes;
