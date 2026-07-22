import type { FastifyPluginAsync } from 'fastify';
import { buildAnalyticsDashboard, type AnalyticsPeriod } from '../lib/analytics-dashboard';

const VALID_PERIODS = new Set<number>([7, 30, 90]);

const analyticsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const query = request.query as { period?: string };
    const parsed = Number(query.period ?? 30);
    const period = (VALID_PERIODS.has(parsed) ? parsed : 30) as AnalyticsPeriod;

    try {
      const dashboard = await buildAnalyticsDashboard(workspaceSlug, period);
      return dashboard;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error analytics';
      if (message.includes('no encontrado')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });
};

export default analyticsRoutes;
