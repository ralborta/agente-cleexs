import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  startGrowthConversationRun,
  cancelGrowthConversationRun,
} from '../lib/agents/growth/conversations/run';
import {
  buildRunSynthesis,
  collectInterventionMetrics,
  registerManualMetric,
} from '../lib/agents/growth/conversations/metrics';
import {
  buildAttributedArticleUrl,
  createAttributionId,
} from '../lib/agents/growth/conversations/attribution';
import { resolveGrowthConversationsConfig } from '../lib/agents/growth/conversations/config';
import { enqueueAgentJob, JOB_GROWTH_METRICS_COLLECT } from '../lib/agent-jobs/queue';
import { isDataForSeoConfigured, resolveDataForSeoConfig } from '../lib/integrations/dataforseo';
import {
  hasGa4Configured,
  resolveGoogleMetricsConfig,
} from '../lib/integrations/google-config';

async function assertWorkspaceAccess(
  request: { authUser?: { workspaceId: string; role: string; id?: string } | null },
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

const opportunityInclude = {
  conversation: true,
  drafts: { orderBy: { version: 'desc' as const }, take: 3 },
  interventions: {
    orderBy: { publishedAt: 'desc' as const },
    take: 5,
    include: { metrics: { orderBy: { capturedAt: 'desc' as const }, take: 10 } },
  },
  serpHit: {
    select: {
      id: true,
      url: true,
      title: true,
      snippet: true,
      position: true,
      resultType: true,
      providerMode: true,
    },
  },
};

export const growthConversationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/conversations/status', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const config = await resolveGrowthConversationsConfig(workspace.id);
    const dfs = resolveDataForSeoConfig();
    const ga4 = resolveGoogleMetricsConfig(workspaceSlug);

    return {
      workspace: workspaceSlug,
      config: {
        autoTriggerOnPublish: config.autoTriggerOnPublish,
        maxQueries: config.maxQueries,
        maxRecommended: config.maxRecommended,
        maxSpendUsd: config.maxSpendUsd,
        languageCode: config.languageCode,
        locationCode: config.locationCode,
        scoreWeights: config.scoreWeights,
        minOpportunityScore: config.minOpportunityScore,
      },
      integrations: {
        dataforseo: {
          configured: isDataForSeoConfigured(),
          mode: dfs?.mode ?? null,
          note:
            dfs?.mode === 'sandbox'
              ? 'Sandbox: datos de prueba, no SERP reales de producción'
              : dfs?.mode === 'live'
                ? 'Live: consume crédito real'
                : 'DataForSEO no configurado — no se pueden buscar conversaciones',
        },
        ga4: {
          configured: hasGa4Configured(ga4),
          note: hasGa4Configured(ga4)
            ? 'GA4 listo para sesiones atribuibles (utm_content)'
            : 'GA4 no configurado — las visitas atribuibles quedarán como desconocidas; contactos/comerciales solo manual',
        },
      },
      limitations: [
        'No hay publicación automática en foros ni mensajes a terceros.',
        'Aprobar un borrador no lo publica.',
        'Contactos y oportunidades comerciales solo por registro manual (no hay CRM conectado).',
        'Sesiones GA4 no son clics medidos; ausencia de datos ≠ cero resultados.',
      ],
    };
  });

  server.get('/:workspaceSlug/conversations/runs', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const runs = await prisma.growthConversationRun.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        piece: { select: { id: true, title: true, slug: true, keyword: true } },
        publication: { select: { id: true, url: true, publishedAt: true } },
      },
    });

    return { workspace: workspaceSlug, runs };
  });

  server.get('/:workspaceSlug/conversations/runs/:runId', async (request, reply) => {
    const { workspaceSlug, runId } = request.params as { workspaceSlug: string; runId: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const run = await prisma.growthConversationRun.findFirst({
      where: { id: runId, workspaceId: workspace.id },
      include: {
        piece: { select: { id: true, title: true, slug: true, keyword: true, status: true } },
        publication: true,
        queries: { orderBy: { createdAt: 'asc' } },
        opportunities: {
          orderBy: [{ recommendedRank: 'asc' }, { opportunityScore: 'desc' }],
          include: opportunityInclude,
        },
      },
    });
    if (!run) return reply.status(404).send({ error: 'Ejecución no encontrada' });

    const synthesis = await buildRunSynthesis(run.id);
    return { workspace: workspaceSlug, run, synthesis };
  });

  server.post('/:workspaceSlug/conversations/from-piece/:pieceId', async (request, reply) => {
    const { workspaceSlug, pieceId } = request.params as {
      workspaceSlug: string;
      pieceId: string;
    };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const piece = await prisma.contentPiece.findFirst({
      where: { id: pieceId, workspaceId: workspace.id, status: 'published' },
      include: { publication: true },
    });
    if (!piece) {
      return reply.status(404).send({ error: 'Pieza publicada no encontrada' });
    }
    if (!piece.publication?.url || !piece.publication.publishedAt) {
      return reply.status(409).send({
        error: 'La pieza no tiene publicación efectiva (URL + publishedAt). Solo se buscan conversaciones tras publicar.',
      });
    }

    const active = await prisma.growthConversationRun.findFirst({
      where: {
        workspaceId: workspace.id,
        pieceId: piece.id,
        status: {
          in: [
            'queued',
            'generating_queries',
            'searching',
            'verifying',
            'scoring',
            'drafting',
          ],
        },
      },
    });
    if (active) {
      return reply.status(409).send({
        error: 'Ya hay una búsqueda en curso para este artículo',
        runId: active.id,
      });
    }

    try {
      const run = await startGrowthConversationRun({
        workspaceId: workspace.id,
        pieceId: piece.id,
        publicationId: piece.publication.id,
        trigger: 'manual',
      });
      return { workspace: workspaceSlug, run };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar búsqueda';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/conversations/runs/:runId/cancel', async (request, reply) => {
    const { workspaceSlug, runId } = request.params as { workspaceSlug: string; runId: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const run = await cancelGrowthConversationRun(runId, workspace.id);
    if (!run) return reply.status(404).send({ error: 'Ejecución no encontrada' });
    return { workspace: workspaceSlug, run };
  });

  server.get('/:workspaceSlug/conversations/opportunities/:id', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const opportunity = await prisma.growthOpportunity.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        ...opportunityInclude,
        piece: { select: { id: true, title: true, keyword: true } },
        run: { select: { id: true, status: true, providerMode: true, costUsd: true, costIsEstimate: true } },
      },
    });
    if (!opportunity) return reply.status(404).send({ error: 'Oportunidad no encontrada' });
    return { workspace: workspaceSlug, opportunity };
  });

  server.patch('/:workspaceSlug/conversations/drafts/:draftId', async (request, reply) => {
    const { workspaceSlug, draftId } = request.params as {
      workspaceSlug: string;
      draftId: string;
    };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const body = z
      .object({
        body: z.string().min(1).max(12000).optional(),
        includeLink: z.boolean().optional(),
        linkUrl: z.string().url().nullable().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: 'Datos inválidos' });

    const existing = await prisma.growthReplyDraft.findFirst({
      where: { id: draftId, workspaceId: workspace.id },
    });
    if (!existing) return reply.status(404).send({ error: 'Borrador no encontrado' });
    if (existing.status === 'discarded') {
      return reply.status(409).send({ error: 'El borrador está descartado' });
    }

    const draft = await prisma.growthReplyDraft.update({
      where: { id: draftId },
      data: {
        ...(body.data.body != null ? { body: body.data.body } : {}),
        ...(body.data.includeLink != null ? { includeLink: body.data.includeLink } : {}),
        ...(body.data.linkUrl !== undefined ? { linkUrl: body.data.linkUrl } : {}),
        // Editar no aprueba ni publica
        status: existing.status === 'approved' ? 'pending_review' : existing.status,
        approvedAt: null,
        approvedById: null,
      },
    });

    if (existing.status === 'approved') {
      await prisma.growthOpportunity.updateMany({
        where: { id: existing.opportunityId, workspaceId: workspace.id },
        data: { editorialStatus: 'draft_ready' },
      });
    }

    return {
      workspace: workspaceSlug,
      draft,
      note: 'Borrador actualizado. Aprobado ≠ publicado.',
    };
  });

  server.post('/:workspaceSlug/conversations/opportunities/:id/approve', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const body = z
      .object({
        draftId: z.string().uuid().optional(),
        body: z.string().min(1).max(12000).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: 'Datos inválidos' });

    const opportunity = await prisma.growthOpportunity.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { drafts: { orderBy: { version: 'desc' }, take: 5 } },
    });
    if (!opportunity) return reply.status(404).send({ error: 'Oportunidad no encontrada' });
    if (opportunity.editorialStatus === 'discarded') {
      return reply.status(409).send({ error: 'Oportunidad descartada' });
    }

    const draft =
      (body.data.draftId
        ? opportunity.drafts.find((d) => d.id === body.data.draftId)
        : opportunity.drafts[0]) ?? null;
    if (!draft) return reply.status(404).send({ error: 'No hay borrador para aprobar' });

    const userId = request.authUser?.id;
    if (!userId) return reply.status(401).send({ error: 'Usuario no autenticado' });

    const updatedDraft = await prisma.growthReplyDraft.update({
      where: { id: draft.id },
      data: {
        ...(body.data.body ? { body: body.data.body } : {}),
        status: 'approved',
        approvedAt: new Date(),
        approvedById: userId,
      },
    });

    await prisma.growthOpportunity.update({
      where: { id },
      data: { editorialStatus: 'approved', discardReason: null },
    });

    return {
      workspace: workspaceSlug,
      opportunityId: id,
      draft: updatedDraft,
      published: false,
      note: 'Borrador aprobado para revisión/copia. Todavía NO está publicado. Registrá la publicación manual cuando lo hayas pegado en el hilo.',
    };
  });

  server.post('/:workspaceSlug/conversations/opportunities/:id/discard', async (request, reply) => {
    const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const body = z
      .object({ reason: z.string().min(1).max(2000) })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.status(400).send({ error: 'Indicá un motivo de descarte' });

    const opportunity = await prisma.growthOpportunity.findFirst({
      where: { id, workspaceId: workspace.id },
    });
    if (!opportunity) return reply.status(404).send({ error: 'Oportunidad no encontrada' });

    await prisma.$transaction([
      prisma.growthOpportunity.update({
        where: { id },
        data: {
          editorialStatus: 'discarded',
          discardReason: body.data.reason,
        },
      }),
      prisma.growthReplyDraft.updateMany({
        where: {
          opportunityId: id,
          workspaceId: workspace.id,
          status: { in: ['pending_review', 'approved'] },
        },
        data: { status: 'discarded' },
      }),
    ]);

    return { workspace: workspaceSlug, opportunityId: id, editorialStatus: 'discarded' };
  });

  server.post(
    '/:workspaceSlug/conversations/opportunities/:id/register-published',
    async (request, reply) => {
      const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
      const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
      if (!workspace) return;
      if (!requireEditor(request, reply)) return;

      const body = z
        .object({
          publishedUrl: z.string().url(),
          publishedAt: z.string().datetime().optional(),
          notes: z.string().max(4000).optional(),
          draftId: z.string().uuid().optional(),
        })
        .safeParse(request.body ?? {});
      if (!body.success) return reply.status(400).send({ error: 'URL de publicación inválida' });

      const opportunity = await prisma.growthOpportunity.findFirst({
        where: { id, workspaceId: workspace.id },
        include: {
          drafts: { orderBy: { version: 'desc' } },
          piece: { include: { publication: true } },
        },
      });
      if (!opportunity) return reply.status(404).send({ error: 'Oportunidad no encontrada' });

      const draft =
        (body.data.draftId
          ? opportunity.drafts.find((d) => d.id === body.data.draftId)
          : opportunity.drafts.find((d) => d.status === 'approved') ?? opportunity.drafts[0]) ??
        null;
      if (!draft) return reply.status(409).send({ error: 'Necesitás un borrador para registrar la publicación' });
      if (draft.status !== 'approved') {
        return reply.status(409).send({
          error: 'Aprobá el borrador antes de registrar la publicación manual',
        });
      }

      const userId = request.authUser?.id;
      if (!userId) return reply.status(401).send({ error: 'Usuario no autenticado' });

      const attributionId = createAttributionId();
      const baseArticleUrl = opportunity.piece.publication?.url ?? null;
      const articleUrlWithUtm = baseArticleUrl
        ? buildAttributedArticleUrl(baseArticleUrl, attributionId)
        : null;

      const intervention = await prisma.growthIntervention.create({
        data: {
          workspaceId: workspace.id,
          opportunityId: id,
          replyDraftId: draft.id,
          attributionId,
          publishedUrl: body.data.publishedUrl,
          publishedAt: body.data.publishedAt ? new Date(body.data.publishedAt) : new Date(),
          registeredById: userId,
          articleUrlWithUtm,
          notes: body.data.notes ?? null,
        },
      });

      // Editorial sigue "approved"; publicado se refleja en intervention
      return {
        workspace: workspaceSlug,
        intervention,
        published: true,
        note: articleUrlWithUtm
          ? 'Publicación manual registrada. Usá articleUrlWithUtm en el enlace si aún no lo pegaste, para atribución GA4.'
          : 'Publicación manual registrada. Sin URL de artículo no hay UTM de atribución.',
        limitations: [
          'Contactos y pipeline comercial no se miden solos: registralos manualmente.',
          'Sesiones GA4 aparecerán solo si el enlace con utm_content fue el usado y GA4 está configurado.',
        ],
      };
    },
  );

  server.post(
    '/:workspaceSlug/conversations/interventions/:id/metrics/collect',
    async (request, reply) => {
      const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
      const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
      if (!workspace) return;
      if (!requireEditor(request, reply)) return;

      const intervention = await prisma.growthIntervention.findFirst({
        where: { id, workspaceId: workspace.id },
      });
      if (!intervention) return reply.status(404).send({ error: 'Intervención no encontrada' });

      const ga4 = resolveGoogleMetricsConfig(workspaceSlug);
      if (!hasGa4Configured(ga4)) {
        return {
          workspace: workspaceSlug,
          collected: false,
          reason: 'GA4 no configurado para este workspace — las sesiones atribuibles quedan desconocidas',
        };
      }

      const result = await collectInterventionMetrics(workspace.id, id);
      return { workspace: workspaceSlug, collected: true, ...result };
    },
  );

  server.post(
    '/:workspaceSlug/conversations/interventions/:id/metrics/manual',
    async (request, reply) => {
      const { workspaceSlug, id } = request.params as { workspaceSlug: string; id: string };
      const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
      if (!workspace) return;
      if (!requireEditor(request, reply)) return;

      const body = z
        .object({
          kind: z.enum(['contact_manual', 'commercial_manual', 'interaction_manual']),
          value: z.number().finite().nonnegative(),
          notes: z.string().max(4000).optional(),
          capturedAt: z.string().datetime().optional(),
        })
        .safeParse(request.body ?? {});
      if (!body.success) return reply.status(400).send({ error: 'Datos de métrica inválidos' });

      try {
        const row = await registerManualMetric({
          workspaceId: workspace.id,
          interventionId: id,
          kind: body.data.kind,
          value: body.data.value,
          notes: body.data.notes,
          capturedAt: body.data.capturedAt ? new Date(body.data.capturedAt) : undefined,
          registeredByHint: request.authUser?.id ?? 'manual',
        });
        return {
          workspace: workspaceSlug,
          metricId: row.id,
          note: 'Métrica manual con procedencia explícita. No confundir con sesiones GA4.',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error';
        return reply.status(404).send({ error: message });
      }
    },
  );

  server.get('/:workspaceSlug/conversations/insights', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;

    const insights = await prisma.growthTopicInsight.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        piece: { select: { id: true, title: true, keyword: true } },
        run: { select: { id: true, status: true } },
      },
    });

    return {
      workspace: workspaceSlug,
      insights,
      note: 'Recomendaciones revisables para Discovery. No cambian prioridades automáticamente.',
    };
  });

  server.post('/:workspaceSlug/conversations/metrics/enqueue-collect', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await assertWorkspaceAccess(request, reply, workspaceSlug);
    if (!workspace) return;
    if (!requireEditor(request, reply)) return;

    const job = await enqueueAgentJob({
      workspaceId: workspace.id,
      type: JOB_GROWTH_METRICS_COLLECT,
      payload: { workspaceId: workspace.id },
    });
    return { workspace: workspaceSlug, jobId: job.id };
  });
};

export default growthConversationRoutes;
