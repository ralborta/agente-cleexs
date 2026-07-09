import type { FastifyPluginAsync } from 'fastify';
import { getGoogleMetricsStatus } from '../lib/integrations/google-config';
import { testGoogleMetrics } from '../lib/metrics-sync';
import { getWordPressStatus, testWorkspaceWordPress } from '../lib/integrations/wordpress-publish';

const integrationRoutes: FastifyPluginAsync = async (server) => {
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
};

export default integrationRoutes;
