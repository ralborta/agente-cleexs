import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  deleteKeywordOpportunity,
  ingestSeedKeywords,
  listKeywordOpportunities,
  updateKeywordOpportunity,
} from '../lib/agents/teo/keyword-opportunities';

const seedSchema = z.object({
  workspace: z.string().min(1),
  seeds: z.array(z.string().min(2).max(160)).min(1).max(20),
  expand: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  status: z.enum(['idea', 'queued', 'in_progress', 'covered', 'discarded']).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  cluster: z.string().min(1).max(160).optional(),
  stage: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  intentLabel: z.string().max(200).nullable().optional(),
});

async function resolveWorkspace(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

function assertWorkspaceAccess(
  authUser: { workspaceId: string; role: string } | undefined,
  workspaceId: string,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (!authUser) {
    return reply.status(401).send({ error: 'Autenticación requerida' });
  }
  if (authUser.workspaceId !== workspaceId) {
    return reply.status(403).send({ error: 'La oportunidad no pertenece a tu workspace' });
  }
  return null;
}

const opportunityRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request, reply) => {
    const q = request.query as {
      workspace?: string;
      status?: string;
      stage?: string;
      cluster?: string;
      seed?: string;
    };
    if (!q.workspace) return reply.status(400).send({ error: 'workspace requerido' });

    const workspace = await resolveWorkspace(q.workspace);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });

    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply);
    if (denied) return denied;

    const result = await listKeywordOpportunities({
      workspaceId: workspace.id,
      status: q.status as never,
      stage: q.stage as never,
      cluster: q.cluster,
      seedKeyword: q.seed,
    });

    return { workspace: q.workspace, ...result };
  });

  /** Carga semillas y genera cloud TOFU/MOFU/BOFU. */
  server.post('/seeds', async (request, reply) => {
    const parsed = seedSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    const workspace = await resolveWorkspace(parsed.data.workspace);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });

    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply);
    if (denied) return denied;

    if (!request.authUser || !['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    try {
      const result = await ingestSeedKeywords(workspace.id, parsed.data.seeds, {
        expand: parsed.data.expand,
      });
      const list = await listKeywordOpportunities({ workspaceId: workspace.id });
      return { ok: true, ...result, ...list };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar oportunidades';
      return reply.status(400).send({ error: message });
    }
  });

  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    const authUser = request.authUser;
    if (!authUser || !['admin', 'editor'].includes(authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    try {
      const opportunity = await updateKeywordOpportunity(authUser.workspaceId, id, parsed.data);
      return { ok: true, opportunity };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      const status = message.includes('no encontrada') ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });

  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const authUser = request.authUser;
    if (!authUser || !['admin', 'editor'].includes(authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    try {
      await deleteKeywordOpportunity(authUser.workspaceId, id);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      const status = message.includes('no encontrada') ? 404 : 400;
      return reply.status(status).send({ error: message });
    }
  });
};

export default opportunityRoutes;
