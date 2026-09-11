import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import {
  buildAuthorizationUrl,
  buildLinkedInConfigFromOAuth,
  createOAuthState,
  disconnectLinkedIn,
  exchangeCodeForToken,
  fetchLinkedInMemberProfile,
  getLinkedInIntegration,
  isLinkedInAppConfigured,
  parseOAuthState,
  publishCreativeRequestToLinkedIn,
  resolveFrontendBaseUrl,
  upsertLinkedInIntegration,
} from '../lib/integrations/linkedin';

async function assertWorkspaceAccess(
  request: { authUser?: { workspaceId: string; role: string } | null },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  workspaceSlug: string,
) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    reply.status(404).send({ error: 'Workspace no encontrado' });
    return null;
  }
  if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
    reply.status(403).send({ error: 'Sin acceso a este workspace' });
    return null;
  }
  return workspace;
}

function requireEditor(
  request: { authUser?: { role: string } | null },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
) {
  if (!request.authUser || !['admin', 'editor'].includes(request.authUser.role)) {
    reply.status(403).send({ error: 'Permiso insuficiente' });
    return false;
  }
  return true;
}

const linkedinRoutes: FastifyPluginAsync = async (server) => {
  /** Callback OAuth público (también registrado vía isPublicApiPath). */
  server.get('/linkedin/callback', async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
    const frontend = resolveFrontendBaseUrl();

    if (query.error) {
      const ws = query.state ? parseOAuthState(query.state)?.ws : null;
      const reason = encodeURIComponent(
        (query.error_description || query.error || 'oauth_error')
          .replace(/&quot;/g, '"')
          .slice(0, 280),
      );
      const target = ws
        ? `${frontend}/${ws}/growth?tab=creativos&linkedin=error&reason=${reason}`
        : `${frontend}/login?linkedin=error&reason=${reason}`;
      return reply.redirect(target);
    }

    if (!query.code || !query.state) {
      return reply.redirect(`${frontend}/login?linkedin=error`);
    }

    const state = parseOAuthState(query.state);
    if (!state) {
      return reply.redirect(`${frontend}/login?linkedin=error`);
    }

    try {
      if (!isLinkedInAppConfigured()) {
        throw new Error('LinkedIn no configurado');
      }
      const workspace = await prisma.workspace.findUnique({ where: { slug: state.ws } });
      if (!workspace) {
        throw new Error('Workspace no encontrado');
      }

      const tokens = await exchangeCodeForToken(query.code);
      const profile = await fetchLinkedInMemberProfile(tokens.access_token);
      const config = buildLinkedInConfigFromOAuth({
        tokens,
        personId: profile.personId,
        personUrn: profile.personUrn,
        userId: state.uid,
      });
      await upsertLinkedInIntegration(workspace.id, config);

      return reply.redirect(
        `${frontend}/${workspace.slug}/growth?tab=creativos&linkedin=connected`,
      );
    } catch {
      return reply.redirect(
        `${frontend}/${state.ws}/growth?tab=creativos&linkedin=error`,
      );
    }
  });

  server.get('/:workspaceSlug/linkedin', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const linkedin = await getLinkedInIntegration(workspace.id);
    return { workspace: workspaceSlug, linkedin };
  });

  server.get('/:workspaceSlug/linkedin/status', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const linkedin = await getLinkedInIntegration(workspace.id);
    return { workspace: workspaceSlug, linkedin };
  });

  server.post('/:workspaceSlug/linkedin/connect', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    if (!isLinkedInAppConfigured()) {
      return reply.status(503).send({
        error:
          'LinkedIn no está configurado en el servidor (faltan variables de entorno de la app).',
      });
    }

    const state = createOAuthState(workspaceSlug, request.authUser!.id);
    const authorizeUrl = buildAuthorizationUrl({ workspaceSlug, state });
    return { workspace: workspaceSlug, authorizeUrl };
  });

  server.post('/:workspaceSlug/linkedin/disconnect', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    await disconnectLinkedIn(workspace.id);
    const linkedin = await getLinkedInIntegration(workspace.id);
    return { workspace: workspaceSlug, linkedin, disconnected: true };
  });

  server.post('/:workspaceSlug/linkedin/publish/:requestId', async (request, reply) => {
    const { workspaceSlug, requestId } = request.params as {
      workspaceSlug: string;
      requestId: string;
    };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    try {
      const result = await publishCreativeRequestToLinkedIn(workspace.id, requestId);
      return { workspace: workspaceSlug, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar en LinkedIn';
      const status =
        message.includes('no está conectado') || message.includes('expiró')
          ? 409
          : message.includes('no encontrado') || message.includes('No hay DistributionPost')
            ? 404
            : 502;
      return reply.status(status).send({ error: message });
    }
  });
};

export default linkedinRoutes;
