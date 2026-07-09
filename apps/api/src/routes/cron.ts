import type { FastifyPluginAsync } from 'fastify';
import { tickAutonomousMissions } from '../lib/job-scheduler';
import { executeMission } from '../lib/mission-executor';

function requireCronSecret(request: { headers: Record<string, string | string[] | undefined> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers['x-cron-secret'];
  return header === secret;
}

const cronRoutes: FastifyPluginAsync = async (server) => {
  server.post('/autonomous-tick', async (request, reply) => {
    if (!requireCronSecret(request)) {
      return reply.status(401).send({ error: 'No autorizado' });
    }
    const result = await tickAutonomousMissions();
    return result;
  });

  server.post('/missions/:id/execute', async (request, reply) => {
    if (!requireCronSecret(request)) {
      return reply.status(401).send({ error: 'No autorizado' });
    }
    const { id } = request.params as { id: string };
    const result = await executeMission(id);
    return result;
  });
};

export default cronRoutes;
