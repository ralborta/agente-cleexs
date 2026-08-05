import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

/** GIF 1×1 transparente */
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const eventsRoutes: FastifyPluginAsync = async (server) => {
  /**
   * Beacon público (pixel) para CTA A/B desde WordPress.
   * GET /api/events/cta?workspace=&variant=A|B&type=click|submit&pieceId=
   */
  server.get('/cta', async (request, reply) => {
    const q = request.query as {
      workspace?: string;
      variant?: string;
      type?: string;
      pieceId?: string;
      url?: string;
    };

    const workspaceSlug = q.workspace?.trim();
    const variant = (q.variant || '').toUpperCase() === 'B' ? 'B' : 'A';
    const eventType = q.type === 'click' ? 'click' : 'submit';

    if (workspaceSlug) {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { slug: workspaceSlug },
          select: { id: true },
        });
        if (workspace) {
          await prisma.ctaEvent.create({
            data: {
              workspaceId: workspace.id,
              pieceId: q.pieceId?.slice(0, 80) || null,
              url: q.url?.slice(0, 500) || null,
              variant,
              eventType,
            },
          });
        }
      } catch (err) {
        request.log.warn({ err }, 'cta event no guardado');
      }
    }

    return reply
      .header('Content-Type', 'image/gif')
      .header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      .header('Access-Control-Allow-Origin', '*')
      .send(PIXEL);
  });

  /** Stats A/B (auth). */
  server.get('/cta-stats', async (request, reply) => {
    const q = request.query as { workspace?: string; days?: string };
    if (!q.workspace) return reply.status(400).send({ error: 'workspace requerido' });

    const workspace = await prisma.workspace.findUnique({ where: { slug: q.workspace } });
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });

    const authUser = request.authUser;
    if (!authUser || authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso' });
    }

    const days = Math.min(90, Math.max(1, Number(q.days) || 30));
    const since = new Date(Date.now() - days * 24 * 3600_000);

    const rows = await prisma.ctaEvent.groupBy({
      by: ['variant', 'eventType'],
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
      _count: { _all: true },
    });

    const byVariant = {
      A: { click: 0, submit: 0, total: 0 },
      B: { click: 0, submit: 0, total: 0 },
    };
    for (const row of rows) {
      const v = row.variant === 'B' ? 'B' : 'A';
      const t = row.eventType === 'click' ? 'click' : 'submit';
      byVariant[v][t] += row._count._all;
      byVariant[v].total += row._count._all;
    }

    const winner =
      byVariant.A.total === 0 && byVariant.B.total === 0
        ? null
        : byVariant.A.total >= byVariant.B.total
          ? 'A'
          : 'B';

    return {
      workspace: q.workspace,
      days,
      byVariant,
      winner,
      total: byVariant.A.total + byVariant.B.total,
    };
  });
};

export default eventsRoutes;
