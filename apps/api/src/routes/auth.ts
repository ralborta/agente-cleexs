import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticateUser, extractBearerToken, signAuthToken, verifyAuthToken } from '../lib/auth';
import { prisma } from '../lib/prisma';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const authRoutes: FastifyPluginAsync = async (server) => {
  server.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email y contraseña requeridos' });
    }

    try {
      const user = await authenticateUser(parsed.data.email, parsed.data.password);
      if (!user) {
        return reply.status(401).send({ error: 'Credenciales inválidas' });
      }

      const token = signAuthToken(user);
      const workspace = await prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { name: true },
      });

      return {
        token,
        user: {
          ...user,
          workspaceName: workspace?.name ?? user.workspaceSlug,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de autenticación';
      return reply.status(500).send({ error: message });
    }
  });

  server.get('/me', async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'No autenticado' });
    }

    const payload = verifyAuthToken(token);
    if (!payload) {
      return reply.status(401).send({ error: 'Sesión expirada' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { workspace: { select: { slug: true, name: true } } },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Usuario no encontrado' });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        workspaceId: user.workspaceId,
        workspaceSlug: user.workspace.slug,
        workspaceName: user.workspace.name,
      },
    };
  });
};

export default authRoutes;
