import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { MKT_AGENTS, buildEmailDraft, campaignFromOpportunity, offerDerivedStatus } from '../lib/marketing/agents';

type ReplyLike = { status: (code: number) => { send: (body: unknown) => unknown } };

async function resolveWorkspace(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

function guard(
  authUser: { workspaceId: string; role: string } | undefined,
  workspaceId: string,
  reply: ReplyLike,
  write = false,
) {
  if (!authUser) return reply.status(401).send({ error: 'Autenticación requerida' });
  if (authUser.workspaceId !== workspaceId) return reply.status(403).send({ error: 'El recurso no pertenece a tu workspace' });
  if (write && !['admin', 'editor'].includes(authUser.role)) return reply.status(403).send({ error: 'Permiso insuficiente' });
  return null;
}

async function wsOr404(slug: string, reply: ReplyLike) {
  const workspace = await resolveWorkspace(slug);
  if (!workspace) {
    reply.status(404).send({ error: 'Workspace no encontrado' });
    return null;
  }
  return workspace;
}

const campaignCreate = z.object({
  title: z.string().min(3).max(200).optional(),
  objective: z.string().min(5).max(4000).optional(),
  audience: z.string().max(1000).nullable().optional(),
  opportunityId: z.string().uuid().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});
const campaignPatch = z.object({
  title: z.string().min(3).max(200).optional(),
  objective: z.string().min(5).max(4000).optional(),
  audience: z.string().max(1000).nullable().optional(),
  status: z.enum(['proposed', 'approved', 'active', 'finished', 'archived']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});
const offerCreate = z.object({
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
const offerPatch = offerCreate.partial().extend({ status: z.enum(['draft', 'approved', 'active', 'archived']).optional() });
const emailPatch = z.object({
  segment: z.string().min(2).max(300).optional(),
  subject: z.string().min(2).max(300).optional(),
  preheader: z.string().max(300).nullable().optional(),
  body: z.string().min(10).max(20000).optional(),
  ctaText: z.string().max(120).nullable().optional(),
  ctaUrl: z.string().max(500).nullable().optional(),
  status: z.enum(['draft', 'approved', 'discarded']).optional(),
});

function serializeOffer<T extends { status: string; endsAt: Date | null }>(o: T) {
  return { ...o, derivedStatus: offerDerivedStatus(o) };
}

const mktRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspace/overview', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply);
    if (denied) return denied;

    const [campaigns, offers, emails, opportunities, pieces, publications, growthOpps] = await Promise.all([
      prisma.marketingCampaign.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { _count: { select: { offers: true, emails: true } } } }),
      prisma.marketingOffer.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.marketingEmailDraft.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.keywordOpportunity.findMany({ where: { workspaceId: workspace.id, status: { in: ['idea', 'queued'] } }, orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }], take: 8 }),
      prisma.contentPiece.count({ where: { workspaceId: workspace.id } }),
      prisma.publication.count({ where: { workspaceId: workspace.id } }),
      prisma.growthOpportunity.count({ where: { workspaceId: workspace.id } }),
    ]);
    const now = new Date();
    const summary = {
      campaigns: campaigns.length,
      campaignsApprovedOrActive: campaigns.filter((c) => c.status === 'approved' || c.status === 'active').length,
      offersActive: offers.filter((o) => offerDerivedStatus(o, now) === 'active' || offerDerivedStatus(o, now) === 'approved').length,
      offersExpired: offers.filter((o) => offerDerivedStatus(o, now) === 'expired').length,
      emailsDraft: emails.filter((e) => e.status === 'draft').length,
      emailsApproved: emails.filter((e) => e.status === 'approved').length,
      opportunitiesOpen: opportunities.length,
      pieces,
      publications,
      diffusionOpportunities: growthOpps,
    };
    return {
      workspace: slug,
      workspaceName: workspace.name,
      product: 'Cleexs Marketing',
      tagline: 'Detectamos oportunidades, creamos tus campañas, las publicamos y medimos si funcionaron.',
      sendingEnabled: false,
      sendingNote: 'El envío real de email se habilita cuando el cliente conecta su dominio (SPF/DKIM) y su lista con consentimiento. Por ahora, el agente deja borradores aprobables.',
      agents: MKT_AGENTS,
      summary,
      campaigns,
      offers: offers.map(serializeOffer),
      emails,
      opportunities,
    };
  });

  server.get('/:workspace/visibilidad', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply);
    if (denied) return denied;
    const [opportunities, questions, all] = await Promise.all([
      prisma.keywordOpportunity.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ opportunityScore: 'desc' }, { priority: 'desc' }], take: 60 }),
      prisma.keywordQuestion.findMany({ where: { workspaceId: workspace.id }, orderBy: { priority: 'desc' }, take: 30 }),
      prisma.keywordOpportunity.findMany({ where: { workspaceId: workspace.id }, select: { gscImpressions: true, gscClicks: true, monthlySearches: true } }),
    ]);
    const google = {
      impressions: all.reduce((a, o) => a + (o.gscImpressions ?? 0), 0),
      clicks: all.reduce((a, o) => a + (o.gscClicks ?? 0), 0),
      searches: all.reduce((a, o) => a + (o.monthlySearches ?? 0), 0),
    };
    return { workspace: slug, google, opportunities, questions };
  });

  server.get('/:workspace/contenidos', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply);
    if (denied) return denied;
    const [pieces, publications] = await Promise.all([
      prisma.contentPiece.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' },
        take: 60,
        select: {
          id: true, title: true, type: true, status: true, slug: true, keyword: true, updatedAt: true,
          publication: { select: { url: true, publishedAt: true } },
          cluster: { select: { name: true } },
        },
      }),
      prisma.publication.count({ where: { workspaceId: workspace.id } }),
    ]);
    const byStatus = pieces.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
    return { workspace: slug, pieces, byStatus, publications };
  });

  server.get('/:workspace/difusion', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply);
    if (denied) return denied;
    const [opportunities, runs] = await Promise.all([
      prisma.growthOpportunity.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { opportunityScore: 'desc' },
        take: 40,
        include: {
          conversation: { select: { url: true, domain: true, title: true, topic: true } },
          drafts: { select: { id: true, status: true }, take: 3 },
        },
      }),
      prisma.growthConversationRun.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, opportunityCount: true, createdAt: true } }),
    ]);
    return { workspace: slug, opportunities, runs };
  });

  server.get('/:workspace/resultados', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply);
    if (denied) return denied;
    const [campaigns, offers, emails, pieces, publications, openOpps, growthOpps] = await Promise.all([
      prisma.marketingCampaign.findMany({ where: { workspaceId: workspace.id }, select: { status: true } }),
      prisma.marketingOffer.findMany({ where: { workspaceId: workspace.id } }),
      prisma.marketingEmailDraft.findMany({ where: { workspaceId: workspace.id }, select: { status: true } }),
      prisma.contentPiece.findMany({ where: { workspaceId: workspace.id }, select: { status: true } }),
      prisma.publication.count({ where: { workspaceId: workspace.id } }),
      prisma.keywordOpportunity.count({ where: { workspaceId: workspace.id, status: { in: ['idea', 'queued'] } } }),
      prisma.growthOpportunity.count({ where: { workspaceId: workspace.id } }),
    ]);
    const now = new Date();
    const expired = offers.filter((o) => offerDerivedStatus(o, now) === 'expired').length;
    const recommendations: Array<{ level: 'alta' | 'media' | 'baja'; text: string; route: string }> = [];
    if (openOpps > 0) recommendations.push({ level: 'alta', text: `Hay ${openOpps} oportunidades de visibilidad sin campaña. Convertí las de mayor puntaje en campañas desde Visibilidad.`, route: '/marketing/visibilidad' });
    if (expired > 0) recommendations.push({ level: 'media', text: `${expired} oferta(s) vencida(s): renovalas o archivalas para no comunicar precios viejos.`, route: '/marketing/ofertas' });
    if (emails.filter((e) => e.status === 'approved').length > 0) recommendations.push({ level: 'media', text: 'Hay emails aprobados esperando: se enviarán cuando el cliente conecte su dominio.', route: '/marketing/email' });
    if (pieces.filter((p) => p.status === 'published').length === 0 && pieces.length > 0) recommendations.push({ level: 'alta', text: 'Hay contenido creado pero nada publicado: revisá aprobaciones y publicá la primera pieza.', route: '/marketing/contenidos' });
    if (growthOpps > 0) recommendations.push({ level: 'baja', text: `${growthOpps} oportunidades de difusión detectadas: prepará propuestas de contacto desde Difusión.`, route: '/marketing/difusion' });
    if (recommendations.length === 0) recommendations.push({ level: 'baja', text: 'Sin alertas: el sistema está al día. Revisá Visibilidad para detectar nuevas oportunidades.', route: '/marketing/visibilidad' });
    return {
      workspace: slug,
      counts: {
        campaigns: campaigns.length,
        campaignsByStatus: campaigns.reduce<Record<string, number>>((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {}),
        offers: offers.length,
        offersExpired: expired,
        emailsByStatus: emails.reduce<Record<string, number>>((a, e) => ({ ...a, [e.status]: (a[e.status] ?? 0) + 1 }), {}),
        pieces: pieces.length,
        piecesByStatus: pieces.reduce<Record<string, number>>((a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }), {}),
        publications,
        diffusionOpportunities: growthOpps,
      },
      recommendations,
    };
  });

  // ——— Escritura: campañas / ofertas / emails ———
  server.post('/:workspace/campaigns', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const parsed = campaignCreate.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const d = parsed.data;
    let { title, objective, audience } = d;
    let sourceType = 'manual';
    let sourceLabel: string | null = null;
    let sourceRefId: string | null = null;
    if (d.opportunityId) {
      const opp = await prisma.keywordOpportunity.findFirst({ where: { id: d.opportunityId, workspaceId: workspace.id } });
      if (!opp) return reply.status(404).send({ error: 'Oportunidad no encontrada' });
      const built = campaignFromOpportunity(opp);
      title = title ?? built.title;
      objective = objective ?? built.objective;
      audience = audience ?? built.audience;
      sourceType = 'opportunity';
      sourceLabel = opp.keyword;
      sourceRefId = opp.id;
    }
    if (!title || !objective) return reply.status(400).send({ error: 'title y objective son requeridos (u opportunityId)' });
    const campaign = await prisma.marketingCampaign.create({
      data: { workspaceId: workspace.id, title, objective, audience: audience ?? null, sourceType, sourceLabel, sourceRefId, startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null },
    });
    return { ok: true, campaign };
  });

  server.patch('/:workspace/campaigns/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const parsed = campaignPatch.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const existing = await prisma.marketingCampaign.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Campaña no encontrada' });
    const d = parsed.data;
    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: { title: d.title, objective: d.objective, audience: d.audience, status: d.status, startsAt: d.startsAt === undefined ? undefined : d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null },
    });
    return { ok: true, campaign };
  });

  server.delete('/:workspace/campaigns/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const existing = await prisma.marketingCampaign.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Campaña no encontrada' });
    await prisma.marketingCampaign.delete({ where: { id } });
    return { ok: true };
  });

  server.post('/:workspace/offers', async (request, reply) => {
    const { workspace: slug } = request.params as { workspace: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const parsed = offerCreate.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const d = parsed.data;
    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) return reply.status(400).send({ error: 'La vigencia "hasta" debe ser posterior a "desde"' });
    if (d.campaignId) {
      const c = await prisma.marketingCampaign.findFirst({ where: { id: d.campaignId, workspaceId: workspace.id } });
      if (!c) return reply.status(404).send({ error: 'Campaña no encontrada' });
    }
    const offer = await prisma.marketingOffer.create({
      data: { workspaceId: workspace.id, campaignId: d.campaignId ?? null, title: d.title, description: d.description, priceText: d.priceText ?? null, discountText: d.discountText ?? null, terms: d.terms ?? null, channels: d.channels ?? ['email', 'web'], startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null },
    });
    return { ok: true, offer: serializeOffer(offer) };
  });

  server.patch('/:workspace/offers/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const parsed = offerPatch.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const existing = await prisma.marketingOffer.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Oferta no encontrada' });
    const d = parsed.data;
    const offer = await prisma.marketingOffer.update({
      where: { id },
      data: { title: d.title, description: d.description, priceText: d.priceText, discountText: d.discountText, terms: d.terms, channels: d.channels, status: d.status, campaignId: d.campaignId, startsAt: d.startsAt === undefined ? undefined : d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null },
    });
    return { ok: true, offer: serializeOffer(offer) };
  });

  server.delete('/:workspace/offers/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const existing = await prisma.marketingOffer.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Oferta no encontrada' });
    await prisma.marketingOffer.delete({ where: { id } });
    return { ok: true };
  });

  server.post('/:workspace/campaigns/:id/generate-email', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id, workspaceId: workspace.id },
      include: { offers: { where: { status: { in: ['approved', 'active'] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaña no encontrada' });
    const offer = campaign.offers[0] ?? null;
    const draft = buildEmailDraft({ workspaceName: workspace.name, campaignTitle: campaign.title, objective: campaign.objective, audience: campaign.audience, offer });
    const email = await prisma.marketingEmailDraft.create({ data: { workspaceId: workspace.id, campaignId: campaign.id, offerId: offer?.id ?? null, ...draft } });
    return { ok: true, email, sent: false, note: 'Borrador creado. El envío requiere el dominio del cliente conectado.' };
  });

  server.patch('/:workspace/emails/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const parsed = emailPatch.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() });
    const existing = await prisma.marketingEmailDraft.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Email no encontrado' });
    const email = await prisma.marketingEmailDraft.update({ where: { id }, data: parsed.data });
    return { ok: true, email, sent: false };
  });

  server.delete('/:workspace/emails/:id', async (request, reply) => {
    const { workspace: slug, id } = request.params as { workspace: string; id: string };
    const workspace = await wsOr404(slug, reply);
    if (!workspace) return;
    const denied = guard(request.authUser, workspace.id, reply, true);
    if (denied) return denied;
    const existing = await prisma.marketingEmailDraft.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!existing) return reply.status(404).send({ error: 'Email no encontrado' });
    await prisma.marketingEmailDraft.delete({ where: { id } });
    return { ok: true };
  });
};

export default mktRoutes;
