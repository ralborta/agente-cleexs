import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  MARKETING_AGENTS,
  buildEmailDraft,
  campaignFromOpportunity,
  offerDerivedStatus,
} from '../lib/agents/marketing/catalog';

async function resolveWorkspace(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

type ReplyLike = { status: (code: number) => { send: (body: unknown) => unknown } };

function assertWorkspaceAccess(
  authUser: { workspaceId: string; role: string } | undefined,
  workspaceId: string,
  reply: ReplyLike,
) {
  if (!authUser) return reply.status(401).send({ error: 'Autenticación requerida' });
  if (authUser.workspaceId !== workspaceId) {
    return reply.status(403).send({ error: 'El recurso no pertenece a tu workspace' });
  }
  return null;
}

function assertEditor(authUser: { role: string } | undefined, reply: ReplyLike) {
  if (!authUser || !['admin', 'editor'].includes(authUser.role)) {
    return reply.status(403).send({ error: 'Permiso insuficiente' });
  }
  return null;
}

const campaignCreateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  objective: z.string().min(5).max(4000).optional(),
  audience: z.string().max(1000).nullable().optional(),
  opportunityId: z.string().uuid().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const campaignPatchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  objective: z.string().min(5).max(4000).optional(),
  audience: z.string().max(1000).nullable().optional(),
  status: z.enum(['proposed', 'approved', 'active', 'finished', 'archived']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const offerCreateSchema = z.object({
  campaignId: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(4000),
  priceText: z.string().max(200).nullable().optional(),
  discountText: z.string().max(200).nullable().optional(),
  terms: z.string().max(2000).nullable().optional(),
  channels: z.array(z.string().max(40)).max(10).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const offerPatchSchema = offerCreateSchema.partial().extend({
  status: z.enum(['draft', 'approved', 'active', 'archived']).optional(),
});

const emailPatchSchema = z.object({
  segment: z.string().min(2).max(300).optional(),
  subject: z.string().min(2).max(300).optional(),
  preheader: z.string().max(300).nullable().optional(),
  body: z.string().min(10).max(20000).optional(),
  ctaText: z.string().max(120).nullable().optional(),
  ctaUrl: z.string().max(500).nullable().optional(),
  status: z.enum(['draft', 'approved', 'discarded']).optional(),
});

function serializeOffer<T extends { status: string; endsAt: Date | null }>(offer: T) {
  return { ...offer, derivedStatus: offerDerivedStatus(offer) };
}

const marketingRoutes: FastifyPluginAsync = async (server) => {
  /** Overview del módulo: 7 agentes + campañas + ofertas + emails + oportunidades top. */
  server.get('/:workspace', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply);
    if (denied) return denied;

    const [campaigns, offers, emails, opportunities, piecesCount, publicationsCount] =
      await Promise.all([
        prisma.marketingCampaign.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { _count: { select: { offers: true, emails: true } } },
        }),
        prisma.marketingOffer.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.marketingEmailDraft.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.keywordOpportunity.findMany({
          where: { workspaceId: workspace.id, status: { in: ['idea', 'queued'] } },
          orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }],
          take: 8,
        }),
        prisma.contentPiece.count({ where: { workspaceId: workspace.id } }),
        prisma.publication.count({ where: { workspaceId: workspace.id } }),
      ]);

    const now = new Date();
    const activeOffers = offers.filter((o) => offerDerivedStatus(o, now) === 'active').length;
    const summary = {
      campaigns: campaigns.length,
      campaignsActive: campaigns.filter((c) => c.status === 'active' || c.status === 'approved').length,
      offers: offers.length,
      offersActive: activeOffers,
      emailsDraft: emails.filter((e) => e.status === 'draft').length,
      emailsApproved: emails.filter((e) => e.status === 'approved').length,
      opportunitiesOpen: opportunities.length,
      pieces: piecesCount,
      publications: publicationsCount,
    };

    const agents = MARKETING_AGENTS.map((agent) => ({
      ...agent,
      status:
        agent.key === 'offers'
          ? `${summary.offers} ofertas · ${activeOffers} activas`
          : agent.key === 'email'
            ? `${summary.emailsDraft} borradores · ${summary.emailsApproved} aprobados (sin envío)`
            : agent.key === 'planner'
              ? `${summary.campaigns} campañas · ${summary.opportunitiesOpen} oportunidades abiertas`
              : agent.key === 'content'
                ? `${piecesCount} piezas · ${publicationsCount} publicaciones`
                : 'Operativo',
    }));

    return {
      workspace: slug,
      module: 'Cleexs Marketing',
      tagline: 'Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron.',
      sendingEnabled: false,
      sendingNote:
        'El envío real de email se habilita cuando el cliente conecta su dominio (SPF/DKIM) y su lista con consentimiento. En v1 los agentes dejan borradores aprobables.',
      agents,
      summary,
      campaigns,
      offers: offers.map(serializeOffer),
      emails,
      opportunities,
    };
  });

  server.post('/:workspace/campaigns', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;

    const parsed = campaignCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const data = parsed.data;

    let title = data.title;
    let objective = data.objective;
    let audience = data.audience ?? null;
    let sourceType = 'manual';
    let sourceLabel: string | null = null;
    let sourceRefId: string | null = null;

    if (data.opportunityId) {
      const opp = await prisma.keywordOpportunity.findFirst({
        where: { id: data.opportunityId, workspaceId: workspace.id },
      });
      if (!opp) return reply.status(404).send({ error: 'Oportunidad no encontrada' });
      const built = campaignFromOpportunity(opp);
      title = title ?? built.title;
      objective = objective ?? built.objective;
      audience = audience ?? built.audience;
      sourceType = 'opportunity';
      sourceLabel = opp.keyword;
      sourceRefId = opp.id;
    }
    if (!title || !objective) {
      return reply.status(400).send({ error: 'title y objective son requeridos (o opportunityId)' });
    }

    const campaign = await prisma.marketingCampaign.create({
      data: {
        workspaceId: workspace.id,
        title,
        objective,
        audience,
        sourceType,
        sourceLabel,
        sourceRefId,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
    return { ok: true, campaign };
  });

  server.patch('/:workspace/campaigns/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const parsed = campaignPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const d = parsed.data;
    const existing = await prisma.marketingCampaign.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Campaña no encontrada' });
    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        title: d.title,
        objective: d.objective,
        audience: d.audience,
        status: d.status,
        startsAt: d.startsAt === undefined ? undefined : d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    return { ok: true, campaign };
  });

  server.delete('/:workspace/campaigns/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const existing = await prisma.marketingCampaign.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Campaña no encontrada' });
    await prisma.marketingCampaign.delete({ where: { id } });
    return { ok: true };
  });

  server.post('/:workspace/offers', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const parsed = offerCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const d = parsed.data;
    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) {
      return reply.status(400).send({ error: 'La vigencia "hasta" debe ser posterior a "desde"' });
    }
    if (d.campaignId) {
      const campaign = await prisma.marketingCampaign.findFirst({ where: { id: d.campaignId, workspaceId: workspace.id } });
      if (!campaign) return reply.status(404).send({ error: 'Campaña no encontrada' });
    }
    const offer = await prisma.marketingOffer.create({
      data: {
        workspaceId: workspace.id,
        campaignId: d.campaignId ?? null,
        title: d.title,
        description: d.description,
        priceText: d.priceText ?? null,
        discountText: d.discountText ?? null,
        terms: d.terms ?? null,
        channels: d.channels ?? ['email', 'web'],
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    return { ok: true, offer: serializeOffer(offer) };
  });

  server.patch('/:workspace/offers/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const parsed = offerPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const existing = await prisma.marketingOffer.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Oferta no encontrada' });
    const d = parsed.data;
    const offer = await prisma.marketingOffer.update({
      where: { id },
      data: {
        title: d.title,
        description: d.description,
        priceText: d.priceText,
        discountText: d.discountText,
        terms: d.terms,
        channels: d.channels,
        status: d.status,
        campaignId: d.campaignId,
        startsAt: d.startsAt === undefined ? undefined : d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    return { ok: true, offer: serializeOffer(offer) };
  });

  server.delete('/:workspace/offers/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const existing = await prisma.marketingOffer.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Oferta no encontrada' });
    await prisma.marketingOffer.delete({ where: { id } });
    return { ok: true };
  });

  /** El agente de Email redacta el borrador de una campaña (nunca envía en v1). */
  server.post('/:workspace/campaigns/:id/generate-email', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;

    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { offers: { where: { status: { in: ['approved', 'active'] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaña no encontrada' });
    const offer = campaign.offers[0] ?? null;
    const draft = buildEmailDraft({
      workspaceName: workspace.name,
      campaignTitle: campaign.title,
      objective: campaign.objective,
      audience: campaign.audience,
      offer,
    });
    const email = await prisma.marketingEmailDraft.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaign.id,
        offerId: offer?.id ?? null,
        ...draft,
      },
    });
    return { ok: true, email, sent: false, note: 'Borrador creado. El envío requiere el dominio del cliente conectado.' };
  });

  server.patch('/:workspace/emails/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const parsed = emailPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const existing = await prisma.marketingEmailDraft.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Email no encontrado' });
    const email = await prisma.marketingEmailDraft.update({ where: { id }, data: parsed.data });
    return {
      ok: true,
      email,
      sent: false,
      note: email.status === 'approved' ? 'Aprobado. Queda listo para enviar cuando se conecte el dominio del cliente.' : undefined,
    };
  });

  server.delete('/:workspace/emails/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await resolveWorkspace(slug);
    if (!workspace) return reply.status(404).send({ error: 'Workspace no encontrado' });
    const denied = assertWorkspaceAccess(request.authUser, workspace.id, reply) ?? assertEditor(request.authUser, reply);
    if (denied) return denied;
    const existing = await prisma.marketingEmailDraft.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Email no encontrado' });
    await prisma.marketingEmailDraft.delete({ where: { id } });
    return { ok: true };
  });
};

export default marketingRoutes;
