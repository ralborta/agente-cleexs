import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  getDiscoveryStatus,
  runDiscoveryExplore,
} from '../lib/agents/discovery/run-explore';

const exploreSchema = z.object({
  siteUrl: z.string().min(4).max(200),
  description: z.string().min(8).max(800),
  market: z.string().min(2).max(32).optional().default('ar'),
  languageCode: z.string().min(2).max(8).optional(),
  seeds: z.array(z.string().min(2).max(80)).min(1).max(20),
  includeSiteKeywords: z.boolean().optional().default(true),
  maxCandidates: z.number().int().min(10).max(80).optional(),
});

const discoveryRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/status', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso a este workspace' });
    }

    const agent = await prisma.agent.findUnique({ where: { slug: 'discovery' } });
    const config = agent
      ? await prisma.agentConfig.findUnique({
          where: {
            workspaceId_agentId: { workspaceId: workspace.id, agentId: agent.id },
          },
        })
      : null;

    return {
      workspace: workspaceSlug,
      ...getDiscoveryStatus(),
      settings: config?.settings ?? null,
      seeds: Array.isArray(config?.topics) ? config?.topics : [],
    };
  });

  server.post('/:workspaceSlug/explore', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso a este workspace' });
    }
    if (!['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }

    const parsed = exploreSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    try {
      const result = await runDiscoveryExplore(workspaceSlug, parsed.data);
      return { workspace: workspaceSlug, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en Discovery';
      return reply.status(502).send({ error: message });
    }
  });
};

export default discoveryRoutes;
