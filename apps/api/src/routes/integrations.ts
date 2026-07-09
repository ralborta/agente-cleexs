import type { FastifyPluginAsync } from 'fastify';
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
};

export default integrationRoutes;
