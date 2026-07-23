import type { FastifyPluginAsync } from 'fastify';
import { getGoogleMetricsStatus } from '../lib/integrations/google-config';
import { testGoogleMetrics, syncWorkspaceMetrics } from '../lib/metrics-sync';
import { getWordPressStatus, testWorkspaceWordPress } from '../lib/integrations/wordpress-publish';
import { getAutomationStatus } from '../lib/automation-status';
import { prisma } from '../lib/prisma';

const integrationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/overview', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }

    const [integrations, automation] = await Promise.all([
      prisma.integration.findMany({ where: { workspaceId: workspace.id } }),
      getAutomationStatus(workspaceSlug),
    ]);

    const wpRow = integrations.find((i) => i.type === 'wordpress');
    const gscRow = integrations.find((i) => i.type === 'google_search_console');
    const ga4Row = integrations.find((i) => i.type === 'google_analytics');

    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      wordpress: getWordPressStatus(workspaceSlug),
      google: getGoogleMetricsStatus(workspaceSlug),
      integrations: {
        wordpress: wpRow
          ? { status: wpRow.status, updatedAt: wpRow.updatedAt.toISOString() }
          : null,
        gsc: gscRow
          ? { status: gscRow.status, updatedAt: gscRow.updatedAt.toISOString(), config: gscRow.config }
          : null,
        ga4: ga4Row
          ? { status: ga4Row.status, updatedAt: ga4Row.updatedAt.toISOString(), config: ga4Row.config }
          : null,
      },
      automation,
    };
  });

  server.get('/:workspaceSlug/wordpress', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const status = getWordPressStatus(workspaceSlug);
    return { workspace: workspaceSlug, wordpress: status };
  });

  server.post('/:workspaceSlug/wordpress/test', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const result = await testWorkspaceWordPress(workspaceSlug);
    return { workspace: workspaceSlug, wordpress: result };
  });

  server.get('/:workspaceSlug/google', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    return { workspace: workspaceSlug, google: getGoogleMetricsStatus(workspaceSlug) };
  });

  server.post('/:workspaceSlug/google/test', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const result = await testGoogleMetrics(workspaceSlug);
    return { workspace: workspaceSlug, google: result };
  });

  server.post('/:workspaceSlug/metrics-sync', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      const result = await syncWorkspaceMetrics(workspaceSlug);
      const automation = await getAutomationStatus(workspaceSlug);
      return { ...result, automation };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en sync de métricas';
      return reply.status(502).send({ error: message });
    }
  });
};

export default integrationRoutes;
