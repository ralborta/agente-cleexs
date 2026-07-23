import type { FastifyPluginAsync } from 'fastify';
import { extractBearerToken, isPublicApiPath, verifyAuthToken } from '../lib/auth';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      role: string;
      workspaceId: string;
      workspaceSlug: string;
    };
  }
}

const authGuardPlugin: FastifyPluginAsync = async (server) => {
  server.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0] ?? request.url;
    if (isPublicApiPath(pathname)) return;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'Autenticación requerida' });
    }

    const payload = verifyAuthToken(token);
    if (!payload) {
      return reply.status(401).send({ error: 'Sesión inválida o expirada' });
    }

    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      workspaceId: payload.workspaceId,
      workspaceSlug: payload.workspaceSlug,
    };
  });
};

export default authGuardPlugin;
