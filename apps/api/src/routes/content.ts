import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  bootstrapClusterAssignments,
  listWorkspaceClusters,
} from '../lib/content-cluster';
import { rerenderPieceFromArticleData } from '../lib/piece-editor';
import {
  archivePieceWithWordPressTrash,
  resyncPublishedPieceToWordPress,
} from '../lib/integrations/wordpress-publish';

function assertWorkspaceAccess(
  authUser: { workspaceId: string; role: string } | undefined,
  workspaceId: string,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (!authUser) {
    return reply.status(401).send({ error: 'Autenticación requerida' });
  }
  if (authUser.workspaceId !== workspaceId) {
    return reply.status(403).send({ error: 'La pieza no pertenece a tu workspace' });
  }
  return null;
}

function assertEditorRole(
  authUser: { role: string } | undefined,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (!authUser || !['admin', 'editor'].includes(authUser.role)) {
    return reply.status(403).send({ error: 'Permiso insuficiente' });
  }
  return null;
}

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

  /**
   * Calendario mensual: piezas del mes por día.
   * - publicado → publication.publishedAt
   * - pendiente → pending_approval (createdAt)
   * - programado → approved sin publicar aún (updatedAt)
   */
  server.get('/calendar', async (request, reply) => {
    const q = request.query as {
      workspace?: string;
      year?: string;
      month?: string;
    };
    if (!q.workspace) return reply.status(400).send({ error: 'workspace requerido' });

    const now = new Date();
    const year = Number(q.year) || now.getFullYear();
    const month = Number(q.month) || now.getMonth() + 1;
    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return reply.status(400).send({ error: 'year/month inválidos' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { slug: q.workspace } });
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });

    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply);
    if (denied) return denied;

    const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    // Margen UTC± para no perder bordes de día en AR (UTC-3).
    const queryStart = new Date(rangeStart.getTime() - 12 * 3600_000);
    const queryEnd = new Date(rangeEnd.getTime() + 12 * 3600_000);

    const tz = 'America/Argentina/Buenos_Aires';
    const dayInAr = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
      return { y: get('year'), m: get('month'), day: get('day') };
    };
    const inMonth = (d: Date) => {
      const { y, m } = dayInAr(d);
      return y === year && m === month;
    };

    const pieces = await prisma.contentPiece.findMany({
      where: {
        workspaceId: workspace.id,
        status: { not: 'archived' },
        OR: [
          {
            status: 'published',
            publication: { publishedAt: { gte: queryStart, lt: queryEnd } },
          },
          {
            status: 'refresh_needed',
            publication: { publishedAt: { gte: queryStart, lt: queryEnd } },
          },
          {
            status: 'pending_approval',
            createdAt: { gte: queryStart, lt: queryEnd },
          },
          {
            status: 'approved',
            updatedAt: { gte: queryStart, lt: queryEnd },
          },
          {
            status: { in: ['draft', 'idea'] },
            createdAt: { gte: queryStart, lt: queryEnd },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        publication: {
          select: { url: true, publishedAt: true, externalId: true },
        },
        cluster: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });

    type CalKind = 'publicado' | 'pendiente' | 'programado' | 'borrador';

    const items = pieces
      .map((p) => {
        let kind: CalKind;
        let date: Date;
        if (p.status === 'published' || p.status === 'refresh_needed') {
          kind = 'publicado';
          date = p.publication?.publishedAt ?? p.updatedAt;
        } else if (p.status === 'pending_approval') {
          kind = 'pendiente';
          date = p.createdAt;
        } else if (p.status === 'approved') {
          kind = 'programado';
          date = p.updatedAt;
        } else {
          kind = 'borrador';
          date = p.createdAt;
        }
        if (!inMonth(date)) return null;
        const { day } = dayInAr(date);
        return {
          id: p.id,
          title: p.title,
          type: p.type,
          status: p.status,
          kind,
          date: date.toISOString(),
          day,
          url: p.publication?.url ?? null,
          cluster: p.cluster,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const byDay: Record<string, typeof items> = {};
    for (const item of items) {
      const key = String(item.day);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(item);
    }

    const counts = {
      publicado: items.filter((i) => i.kind === 'publicado').length,
      pendiente: items.filter((i) => i.kind === 'pendiente').length,
      programado: items.filter((i) => i.kind === 'programado').length,
      borrador: items.filter((i) => i.kind === 'borrador').length,
    };

    return {
      workspace: q.workspace,
      year,
      month,
      daysInMonth: new Date(year, month, 0).getDate(),
      counts,
      items,
      byDay,
    };
  });

  /** Archiva la pieza y mueve el post WP a papelera si existe. */
  server.post('/pieces/:id/archive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { workspace?: string }) ?? {};
    const authUser = request.authUser;

    const roleDenied = assertEditorRole(authUser, reply);
    if (roleDenied) return roleDenied;

    const piece = await prisma.contentPiece.findUnique({
      where: { id },
      include: { workspace: { select: { id: true, slug: true } } },
    });
    if (!piece) return reply.status(404).send({ error: 'Pieza no encontrada' });

    const denied = assertWorkspaceAccess(authUser, piece.workspaceId, reply);
    if (denied) return denied;

    const workspaceSlug = body.workspace || piece.workspace.slug;

    try {
      const result = await archivePieceWithWordPressTrash(workspaceSlug, id, {
        workspaceId: authUser!.workspaceId,
      });
      return { ok: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al archivar';
      const status = message.includes('no encontrada')
        ? 404
        : message.includes('no pertenece')
          ? 403
          : 502;
      return reply.status(status).send({ error: message });
    }
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
