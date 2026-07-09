import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

const agentRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async () => {
    const agents = await prisma.agent.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
    });
    return { agents };
  });

  server.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const agent = await prisma.agent.findUnique({
      where: { slug },
      include: {
        configs: {
          include: { workspace: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!agent) {
      return reply.status(404).send({ error: 'Agente no encontrado' });
    }
    return { agent };
  });
};

export default agentRoutes;
