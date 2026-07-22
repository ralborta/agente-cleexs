import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logAgentActivity } from '../lib/agent-helpers';
import { queueMissionExecution } from '../lib/mission-executor';
import { buildMissionObjective } from '../lib/agents/teo/mission-plan';

const createMissionSchema = z.object({
  workspaceSlug: z.string().min(1),
  agentSlug: z.string().min(1).default('teo'),
  title: z.string().min(1).optional(),
  objective: z.string().optional(),
  autoExecute: z.boolean().default(true),
  /** Tema principal (ej. "visibilidad en IA") */
  topic: z.string().min(1).optional(),
  /** pillar | faq | checklist | comparison | how_to */
  pieceType: z.enum(['pillar', 'faq', 'checklist', 'comparison', 'how_to']).optional(),
  /** pro = artículo profundo con ejemplos, referencias y links */
  depth: z.enum(['standard', 'pro']).optional(),
});

const missionRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (request) => {
    const { workspace: workspaceSlug, agent: agentSlug, status } = request.query as {
      workspace?: string;
      agent?: string;
      status?: string;
    };

    const missions = await prisma.mission.findMany({
      where: {
        ...(workspaceSlug ? { workspace: { slug: workspaceSlug } } : {}),
        ...(agentSlug ? { agent: { slug: agentSlug } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        agent: { select: { slug: true, name: true } },
        workspace: { select: { slug: true, name: true } },
        steps: { orderBy: { createdAt: 'asc' } },
        _count: { select: { pieces: true, activities: true } },
      },
    });

    return { missions };
  });

  server.post('/', async (request, reply) => {
    const parsed = createMissionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { workspaceSlug, agentSlug, title, objective, autoExecute, topic, pieceType, depth } =
      parsed.data;

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });

    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const mission = await prisma.mission.create({
      data: {
        workspaceId: workspace.id,
        agentId: agent.id,
        title: title ?? `Misión manual — ${new Date().toLocaleDateString('es-AR')}`,
        objective: buildMissionObjective(objective, { topic, pieceType, depth }),
        status: 'pending',
        trigger: 'manual',
      },
      include: {
        agent: { select: { slug: true, name: true } },
        workspace: { select: { slug: true, name: true } },
      },
    });

    await logAgentActivity({
      workspaceId: workspace.id,
      agentId: agent.id,
      missionId: mission.id,
      role: 'strategist',
      message: `Misión encolada: ${mission.title}`,
    });

    if (autoExecute) {
      queueMissionExecution(mission.id);
    }

    return reply.status(201).send({ mission, executing: autoExecute });
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: {
        agent: true,
        workspace: true,
        steps: { orderBy: { createdAt: 'asc' } },
        pieces: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!mission) {
      return reply.status(404).send({ error: 'Misión no encontrada' });
    }
    return { mission };
  });
};

export default missionRoutes;
