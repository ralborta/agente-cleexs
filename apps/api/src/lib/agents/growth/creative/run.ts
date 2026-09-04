import { prisma } from '../../../prisma';
import { buildCreativeInputFromPiece } from './build-input';
import { loadGrowthBrand } from './brand';
import { planCreative } from './planner';
import { renderCreativeAsset } from './render';
import { ensureCreativeTemplatesSynced } from './sync-templates';
import { getTemplateConfig } from './templates/registry';

async function logGrowth(workspaceId: string, message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const growth = await prisma.agent.findUnique({ where: { slug: 'growth' } });
  if (!growth) return;
  await prisma.agentActivity.create({
    data: {
      workspaceId,
      agentId: growth.id,
      level,
      message,
    },
  });
}

export async function processCreativeRequest(requestId: string) {
  await ensureCreativeTemplatesSynced();

  const request = await prisma.creativeRequest.findUnique({
    where: { id: requestId },
    include: {
      piece: true,
      publication: true,
      workspace: true,
    },
  });
  if (!request) throw new Error('CreativeRequest no encontrado');

  const brandPack = await loadGrowthBrand(
    request.workspaceId,
    request.workspace.slug,
    request.workspace.name,
  );

  if (!brandPack) {
    await prisma.creativeRequest.update({
      where: { id: requestId },
      data: {
        status: 'blocked',
        errorMessage: 'Falta BrandKit de distribución (brandName). Configurá Growth antes de generar.',
      },
    });
    await logGrowth(request.workspaceId, 'Creative bloqueado: falta BrandKit', 'error');
    return { status: 'blocked' as const };
  }

  await prisma.creativeRequest.update({
    where: { id: requestId },
    data: { status: 'planning', errorMessage: null },
  });

  const input = buildCreativeInputFromPiece({
    brandId: request.workspace.slug,
    piece: request.piece,
    publication: request.publication,
    defaultCta: brandPack.distribution.defaultCta,
  });

  const planned = await planCreative(input);

  await prisma.creativeRequest.update({
    where: { id: requestId },
    data: {
      status: 'rendering',
      input: input as object,
      plannerOutput: {
        ...planned.plan,
        meta: {
          source: planned.source,
          attempts: planned.attempts,
          lastIssues: planned.lastIssues ?? [],
        },
      } as object,
    },
  });

  const templateConfig = getTemplateConfig(planned.plan.templateKey);
  if (!templateConfig) {
    await prisma.creativeRequest.update({
      where: { id: requestId },
      data: { status: 'failed', errorMessage: `Template ${planned.plan.templateKey} no encontrado` },
    });
    return { status: 'failed' as const };
  }

  const dbTemplate = await prisma.creativeTemplate.findUnique({
    where: {
      templateKey_version: {
        templateKey: templateConfig.templateKey,
        version: templateConfig.version,
      },
    },
  });
  if (!dbTemplate) {
    await prisma.creativeRequest.update({
      where: { id: requestId },
      data: { status: 'failed', errorMessage: 'Template no sincronizado en DB' },
    });
    return { status: 'failed' as const };
  }

  let rendered;
  try {
    rendered = await renderCreativeAsset({
      workspaceSlug: request.workspace.slug,
      requestId,
      brand: brandPack.distribution,
      template: templateConfig,
      plan: planned.plan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de render';
    await prisma.creativeRequest.update({
      where: { id: requestId },
      data: { status: 'failed', errorMessage: message },
    });
    await logGrowth(request.workspaceId, `Creative render falló: ${message}`, 'error');
    return { status: 'failed' as const, error: message };
  }

  const asset = await prisma.creativeAsset.create({
    data: {
      workspaceId: request.workspaceId,
      requestId,
      templateId: dbTemplate.id,
      templateKey: templateConfig.templateKey,
      templateVersion: templateConfig.version,
      filePath: rendered.filePath,
      mimeType: rendered.mimeType,
      width: rendered.width,
      height: rendered.height,
      format: planned.plan.format,
      payload: {
        plan: planned.plan,
        engine: rendered.engine,
      } as object,
      version: 1,
    },
  });

  await prisma.distributionPost.create({
    data: {
      workspaceId: request.workspaceId,
      requestId,
      assetId: asset.id,
      channel: 'linkedin',
      status: 'preview',
      caption: `${planned.plan.headline}\n\n${input.url || ''}`.trim(),
    },
  });

  await prisma.creativeRequest.update({
    where: { id: requestId },
    data: { status: 'preview' },
  });

  await logGrowth(
    request.workspaceId,
    `Creative listo · ${templateConfig.templateKey} · ${request.piece.title.slice(0, 60)}`,
    'success',
  );

  return { status: 'preview' as const, assetId: asset.id, templateKey: templateConfig.templateKey };
}

export async function enqueueCreativeFromPublication(params: {
  workspaceId: string;
  pieceId: string;
  publicationId?: string;
}): Promise<{ requestId: string } | null> {
  try {
    await ensureCreativeTemplatesSynced();

    const existing = await prisma.creativeRequest.findFirst({
      where: {
        workspaceId: params.workspaceId,
        pieceId: params.pieceId,
        status: { in: ['queued', 'planning', 'rendering', 'preview', 'approved'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { requestId: existing.id };

    const request = await prisma.creativeRequest.create({
      data: {
        workspaceId: params.workspaceId,
        pieceId: params.pieceId,
        publicationId: params.publicationId,
        channel: 'linkedin',
        status: 'queued',
      },
    });

    void processCreativeRequest(request.id).catch((err) => {
      console.warn('[creative] process falló', err);
    });

    return { requestId: request.id };
  } catch (err) {
    console.warn('[creative] enqueue falló', err);
    return null;
  }
}

export async function createAndProcessFromPiece(params: {
  workspaceId: string;
  pieceId: string;
}): Promise<{ requestId: string; result: Awaited<ReturnType<typeof processCreativeRequest>> }> {
  const publication = await prisma.publication.findUnique({ where: { pieceId: params.pieceId } });
  const request = await prisma.creativeRequest.create({
    data: {
      workspaceId: params.workspaceId,
      pieceId: params.pieceId,
      publicationId: publication?.id,
      channel: 'linkedin',
      status: 'queued',
    },
  });
  const result = await processCreativeRequest(request.id);
  return { requestId: request.id, result };
}
