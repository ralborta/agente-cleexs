import type { FastifyPluginAsync } from 'fastify';
import { runSchedulerTick } from '../lib/job-scheduler';
import { executeMission } from '../lib/mission-executor';
import { syncWorkspaceMetrics } from '../lib/metrics-sync';

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
    const result = await runSchedulerTick();
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

  server.post('/metrics-sync', async (request, reply) => {
    if (!requireCronSecret(request)) {
      return reply.status(401).send({ error: 'No autorizado' });
    }
    const { workspace: workspaceSlug } = (request.body as { workspace?: string }) ?? {};
    const slug = workspaceSlug ?? 'cleexs';
    try {
      const result = await syncWorkspaceMetrics(slug);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en sync de métricas';
      return reply.status(502).send({ error: message });
    }
  });
};

export default cronRoutes;
