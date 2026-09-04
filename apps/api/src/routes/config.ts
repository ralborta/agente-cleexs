import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BRAND_TEMPLATE_IDS, type BrandTemplateId } from '@agente/shared';
import { prisma } from '../lib/prisma';
import { getAutomationStatus } from '../lib/automation-status';
import { FREQUENCY_PRESETS } from '../lib/frequency';
import { resolveBrandKit } from '../lib/branding/brand-kit';
import { renderBrandPreviewHtml } from '../lib/agents/teo/article-template';
import { ensureOpportunityCloudFromSeeds } from '../lib/agents/teo/keyword-opportunities';

const BRAND_TEMPLATE_LABELS: Record<BrandTemplateId, string> = {
  default: 'Clásico (default)',
  minimal: 'Minimal',
  corporate: 'Corporate (con logo)',
  editorial: 'Editorial PRO (hero oscuro, secciones numeradas)',
  modern: 'Modern Blog (Stitch clean light)',
};

const brandCtaSchema = z.object({
  headline: z.string().max(200).optional(),
  body: z.string().max(500).optional(),
  label: z.string().max(80).optional(),
  url: z.string().max(500).optional().or(z.literal('')),
  buttonColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  urlInput: z.boolean().optional(),
  placeholder: z.string().max(120).optional(),
});

const brandingSchema = z.object({
  templateId: z.enum(BRAND_TEMPLATE_IDS).optional(),
  brandName: z.string().min(1).max(120).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().max(200).optional(),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  authorAvatarUrl: z.string().url().max(500).optional().or(z.literal('')),
  authorLine: z.string().max(200).optional(),
  cta: brandCtaSchema.optional(),
  ctaB: brandCtaSchema.optional(),
  ctaAbEnabled: z.boolean().optional(),
});

const updateConfigSchema = z.object({
  tone: z.string().optional(),
  topics: z.array(z.string().min(1)).min(1).optional(),
  frequency: z.string().optional(),
  autoPublish: z.boolean().optional(),
  branding: brandingSchema.optional(),
});

const configRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/agents/:agentSlug', async (request, reply) => {
    const { workspaceSlug, agentSlug } = request.params as {
      workspaceSlug: string;
      agentSlug: string;
    };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });
    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const [config, automation] = await Promise.all([
      prisma.agentConfig.findUnique({
        where: {
          workspaceId_agentId: {
            workspaceId: workspace.id,
            agentId: agent.id,
          },
        },
      }),
      getAutomationStatus(workspaceSlug).catch(() => null),
    ]);

    const branding = resolveBrandKit(config?.branding, workspace.name);

    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      agent: { slug: agent.slug, name: agent.name },
      config: config ?? null,
      branding,
      automation,
      frequencyPresets: FREQUENCY_PRESETS,
      brandTemplates: BRAND_TEMPLATE_IDS.map((id) => ({
        id,
        label: BRAND_TEMPLATE_LABELS[id],
      })),
    };
  });

  server.get('/:workspaceSlug/agents/:agentSlug/brand-preview', async (request, reply) => {
    const { workspaceSlug, agentSlug } = request.params as {
      workspaceSlug: string;
      agentSlug: string;
    };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });
    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const config = await prisma.agentConfig.findUnique({
      where: {
        workspaceId_agentId: { workspaceId: workspace.id, agentId: agent.id },
      },
    });

    const branding = resolveBrandKit(config?.branding, workspace.name);
    return { html: renderBrandPreviewHtml(branding), branding };
  });

  server.patch('/:workspaceSlug/agents/:agentSlug', async (request, reply) => {
    const { workspaceSlug, agentSlug } = request.params as {
      workspaceSlug: string;
      agentSlug: string;
    };

    const parsed = updateConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    const agent = await prisma.agent.findUnique({ where: { slug: agentSlug } });
    if (!workspace || !agent) {
      return reply.status(404).send({ error: 'Workspace o agente no encontrado' });
    }

    const existing = await prisma.agentConfig.findUnique({
      where: {
        workspaceId_agentId: { workspaceId: workspace.id, agentId: agent.id },
      },
    });

    const mergedBranding =
      parsed.data.branding !== undefined
        ? {
            ...(existing?.branding && typeof existing.branding === 'object'
              ? (existing.branding as Record<string, unknown>)
              : {}),
            ...parsed.data.branding,
            cta: {
              ...(existing?.branding &&
              typeof existing.branding === 'object' &&
              (existing.branding as { cta?: object }).cta
                ? (existing.branding as { cta: object }).cta
                : {}),
              ...(parsed.data.branding.cta ?? {}),
            },
            ...(parsed.data.branding.ctaB !== undefined
              ? {
                  ctaB: {
                    ...(existing?.branding &&
                    typeof existing.branding === 'object' &&
                    (existing.branding as { ctaB?: object }).ctaB
                      ? (existing.branding as { ctaB: object }).ctaB
                      : {}),
                    ...parsed.data.branding.ctaB,
                  },
                }
              : {}),
            ...(parsed.data.branding.ctaAbEnabled !== undefined
              ? { ctaAbEnabled: parsed.data.branding.ctaAbEnabled }
              : {}),
          }
        : undefined;

    const updatePayload = {
      ...(parsed.data.tone !== undefined ? { tone: parsed.data.tone } : {}),
      ...(parsed.data.topics !== undefined ? { topics: parsed.data.topics } : {}),
      ...(parsed.data.frequency !== undefined ? { frequency: parsed.data.frequency } : {}),
      ...(parsed.data.autoPublish !== undefined ? { autoPublish: parsed.data.autoPublish } : {}),
      ...(mergedBranding !== undefined ? { branding: mergedBranding } : {}),
    };

    const config = await prisma.agentConfig.upsert({
      where: {
        workspaceId_agentId: {
          workspaceId: workspace.id,
          agentId: agent.id,
        },
      },
      update: updatePayload,
      create: {
        workspaceId: workspace.id,
        agentId: agent.id,
        topics: parsed.data.topics ?? ['visibilidad en IA'],
        ...updatePayload,
      },
    });

    const automation = await getAutomationStatus(workspaceSlug);
    const branding = resolveBrandKit(config.branding, workspace.name);

    // Autonomía: al guardar temas, Teo expande el cloud en background (sin clicks).
    if (agentSlug === 'teo' && Array.isArray(parsed.data.topics) && parsed.data.topics.length > 0) {
      const seeds = parsed.data.topics;
      setImmediate(() => {
        ensureOpportunityCloudFromSeeds(workspace.id, seeds).catch((err) => {
          console.warn(
            '[config] cloud oportunidades falló:',
            err instanceof Error ? err.message : err,
          );
        });
      });
    }

    return { config, branding, automation };
  });
};

export default configRoutes;
