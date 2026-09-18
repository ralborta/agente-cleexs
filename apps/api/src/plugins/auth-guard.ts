import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { extractBearerToken, isPublicApiPath, verifyAuthToken } from '../lib/auth';
import { prisma } from '../lib/prisma';

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

function readHeaderSecret(request: { headers: Record<string, unknown> }): string | undefined {
  const raw = request.headers['x-portal-secret'] ?? request.headers['x-cron-secret'];
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim();
  return undefined;
}

function expectedPortalSecret(): string {
  return (process.env.PORTAL_SERVICE_SECRET || process.env.CRON_SECRET || '').trim();
}

function isPortalProxyPath(pathname: string): boolean {
  return pathname.startsWith('/api/discovery/') || pathname.startsWith('/api/opportunities');
}

function extractWorkspaceSlug(pathname: string, rawUrl: string): string | null {
  const discoveryMatch = pathname.match(/^\/api\/discovery\/([^/]+)\//);
  if (discoveryMatch?.[1]) return discoveryMatch[1];
  try {
    const url = new URL(rawUrl, 'http://local');
    return url.searchParams.get('workspace');
  } catch {
    return null;
  }
}

const authGuardPlugin: FastifyPluginAsync = async (server) => {
  server.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0] ?? request.url;
    if (isPublicApiPath(pathname)) return;

    // Portal Cleexs: service secret → sesión sintética del workspace (Discovery / Oportunidades).
    if (isPortalProxyPath(pathname)) {
      const expected = expectedPortalSecret();
      const got = readHeaderSecret(request as { headers: Record<string, unknown> });
      if (expected && got && got === expected) {
        const slug = extractWorkspaceSlug(pathname, request.url);
        if (!slug) {
          return reply.status(400).send({ error: 'workspace requerido' });
        }
        const workspace = await prisma.workspace.findUnique({ where: { slug } });
        if (!workspace) {
          return reply.status(404).send({ error: 'Workspace no encontrado' });
        }
        const admin = await prisma.user.findFirst({
          where: { workspaceId: workspace.id, role: 'admin' },
          orderBy: { createdAt: 'asc' },
        });
        request.authUser = {
          id: admin?.id ?? 'portal-service',
          email: admin?.email ?? 'portal@cleexs.local',
          role: 'admin',
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
        };
        return;
      }
    }

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

export default fp(authGuardPlugin);
