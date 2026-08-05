import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logAgentActivity } from '../lib/agent-helpers';
import { publishAndRecordPiece } from '../lib/integrations/wordpress-publish';
import { updateApprovalPieceContent } from '../lib/piece-editor';

const reviewSchema = z.object({
  notes: z.string().optional(),
  /** draft | publish — override del env al aprobar */
  wpStatus: z.enum(['draft', 'publish']).optional(),
});

const editPieceSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  excerpt: z.string().max(500).optional(),
  markdown: z.string().max(100_000).optional(),
  articleData: z
    .object({
      kicker: z.string().max(120).optional(),
      title: z.string().max(300).optional(),
      lead: z.string().max(5000).optional(),
      pieceType: z.string().max(40).optional(),
      sections: z
        .array(
          z
            .object({
              heading: z.string().max(300).optional(),
              body: z.string().max(50_000).optional(),
              items: z.array(z.string().max(2000)).max(40).optional(),
              faqs: z
                .array(z.object({ q: z.string().max(500), a: z.string().max(5000) }))
                .max(30)
                .optional(),
              table: z
                .object({
                  headers: z.array(z.string().max(120)).max(12),
                  rows: z.array(z.array(z.string().max(500)).max(12)).max(40),
                })
                .optional(),
              examples: z
                .array(z.object({ title: z.string().max(200), body: z.string().max(5000) }))
                .max(20)
                .optional(),
              callout: z.string().max(5000).optional(),
              chart: z.unknown().optional(),
            })
            .passthrough(),
        )
        .min(1)
        .max(40),
      references: z
        .array(
          z.object({
            title: z.string().max(300),
            url: z.string().max(2000),
            note: z.string().max(500).optional(),
          }),
        )
        .max(20)
        .optional(),
    })
    .passthrough()
    .optional(),
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
        piece: {
          include: {
            mission: { select: { agent: { select: { name: true, slug: true } } } },
          },
        },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return { approvals, pendingCount: approvals.filter((a) => a.status === 'pending').length };
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        piece: {
          include: {
            mission: { select: { agent: { select: { name: true, slug: true } } } },
          },
        },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!approval) {
      return reply.status(404).send({ error: 'Aprobación no encontrada' });
    }
    return { approval };
  });

  server.patch('/:id/piece', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = editPieceSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { piece } = await updateApprovalPieceContent(id, parsed.data as Parameters<
        typeof updateApprovalPieceContent
      >[1]);
      return { ok: true, piece };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      const status = message.includes('no encontrada') ? 404 : message.includes('pendiente') ? 409 : 400;
      return reply.status(status).send({ error: message });
    }
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

    // Recargar pieza por si hubo edición previa en la misma sesión
    const piece = await prisma.contentPiece.findUniqueOrThrow({ where: { id: approval.pieceId } });

    const refreshOfPieceId = (piece.content as { refreshOfPieceId?: string } | null)?.refreshOfPieceId;

    let wpResult: { externalId: string; url: string; status: string };
    try {
      wpResult = await publishAndRecordPiece(
        approval.workspace.slug,
        approval.workspaceId,
        piece,
        { wpStatus: parsed.data.wpStatus ?? 'publish' },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar en WordPress';
      return reply.status(502).send({
        error: 'No se pudo publicar en WordPress',
        detail: message,
      });
    }

    if (refreshOfPieceId) {
      await prisma.approval.update({
        where: { id },
        data: {
          status: 'approved',
          notes: parsed.data.notes,
          reviewedAt: new Date(),
        },
      });
    } else {
      await prisma.approval.update({
        where: { id },
        data: {
          status: 'approved',
          notes: parsed.data.notes,
          reviewedAt: new Date(),
        },
      });
    }

    const teo = await prisma.agent.findUnique({ where: { slug: 'teo' } });
    if (teo) {
      const logMessage = refreshOfPieceId
        ? `Refresco de "${approval.piece.title}" publicado en WordPress (${wpResult.status}) — ${wpResult.url}`
        : `"${approval.piece.title}" publicada en WordPress (${wpResult.status}) — ${wpResult.url}`;
      await logAgentActivity({
        workspaceId: approval.workspaceId,
        agentId: teo.id,
        role: refreshOfPieceId ? 'refresher' : 'publisher',
        level: 'success',
        message: logMessage,
      });
    }

    return {
      ok: true,
      pieceId: refreshOfPieceId ?? approval.pieceId,
      refreshOfPieceId: refreshOfPieceId ?? undefined,
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
