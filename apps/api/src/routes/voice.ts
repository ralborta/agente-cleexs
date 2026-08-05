import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  addFounderQuotes,
  createFounderVoiceInvite,
  getInviteByToken,
  listFounderVoice,
  submitQuotesForInvite,
} from '../lib/agents/teo/founder-voice';

const quotesSchema = z.object({
  workspace: z.string().min(1),
  topic: z.string().max(160).optional().nullable(),
  quotes: z.array(z.string().min(12).max(600)).min(1).max(8),
  authorLabel: z.string().max(80).optional(),
});

const inviteSchema = z.object({
  workspace: z.string().min(1),
  topic: z.string().max(160).optional().nullable(),
});

const publicSubmitSchema = z.object({
  quotes: z.array(z.string().min(12).max(600)).min(1).max(5),
  authorLabel: z.string().max(80).optional(),
});

async function resolveWorkspace(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

const voiceRoutes: FastifyPluginAsync = async (server) => {
  /** Público: detalle del invite mágico. */
  server.get('/public/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const invite = await getInviteByToken(token);
    if (!invite) return reply.status(404).send({ error: 'Link no encontrado' });
    return {
      ok: true,
      expired: invite.expired,
      topic: invite.topic,
      workspaceName: invite.workspace.name,
      expiresAt: invite.expiresAt,
      consumed: Boolean(invite.consumedAt),
    };
  });

  /** Público: CEO pega frases sin login. */
  server.post('/public/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const parsed = publicSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    try {
      const result = await submitQuotesForInvite({
        token,
        quotes: parsed.data.quotes,
        authorLabel: parsed.data.authorLabel,
      });
      return { ok: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar';
      return reply.status(400).send({ error: message });
    }
  });

  server.get('/', async (request, reply) => {
    const q = request.query as { workspace?: string };
    if (!q.workspace) return reply.status(400).send({ error: 'workspace requerido' });
    const workspace = await resolveWorkspace(q.workspace);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso' });
    }
    const data = await listFounderVoice(workspace.id);
    return { workspace: q.workspace, ...data };
  });

  server.post('/quotes', async (request, reply) => {
    const parsed = quotesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const workspace = await resolveWorkspace(parsed.data.workspace);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso' });
    }
    if (!['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }
    try {
      const notes = await addFounderQuotes({
        workspaceId: workspace.id,
        topic: parsed.data.topic,
        quotes: parsed.data.quotes,
        authorLabel: parsed.data.authorLabel,
      });
      return { ok: true, created: notes.length, notes };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      return reply.status(400).send({ error: message });
    }
  });

  server.post('/invite', async (request, reply) => {
    const parsed = inviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }
    const workspace = await resolveWorkspace(parsed.data.workspace);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    if (!request.authUser || request.authUser.workspaceId !== workspace.id) {
      return reply.status(403).send({ error: 'Sin acceso' });
    }
    if (!['admin', 'editor'].includes(request.authUser.role)) {
      return reply.status(403).send({ error: 'Permiso insuficiente' });
    }
    const invite = await createFounderVoiceInvite({
      workspaceId: workspace.id,
      topic: parsed.data.topic,
    });
    return { ok: true, ...invite };
  });
};

export default voiceRoutes;
