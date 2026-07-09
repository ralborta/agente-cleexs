import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const updateConfigSchema = z.object({
  tone: z.string().optional(),
  topics: z.array(z.string().min(1)).min(1).optional(),
  frequency: z.string().optional(),
  autoPublish: z.boolean().optional(),
});

const configRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/agents/:agentSlug', async (request, reply) => {
    const { workspaceSlug, agentSlug } = request.params as {
      workspaceSlug: string;
      agentSlug: string;
    };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });
    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const config = await prisma.agentConfig.findUnique({
      where: {
        workspaceId_agentId: {
          workspaceId: workspace.id,
          agentId: agent.id,
        },
      },
    });

    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      agent: { slug: agent.slug, name: agent.name },
      config: config ?? null,
    };
  });

  server.patch('/:workspaceSlug/agents/:agentSlug', async (request, reply) => {
    const { workspaceSlug, agentSlug } = request.params as {
      workspaceSlug: string;
      agentSlug: string;
    };

    const parsed = updateConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });
    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const config = await prisma.agentConfig.upsert({
      where: {
        workspaceId_agentId: {
          workspaceId: workspace.id,
          agentId: agent.id,
        },
      },
      update: parsed.data,
      create: {
        workspaceId: workspace.id,
        agentId: agent.id,
        ...parsed.data,
        topics: parsed.data.topics ?? ['visibilidad en IA'],
      },
    });

    return { config };
  });
};

export default configRoutes;
