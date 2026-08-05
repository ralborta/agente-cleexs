import type { ContentPiece } from '@prisma/client';
import { prisma } from '../prisma';
import {
  ensureDefaultCluster,
  enrichHtmlWithClusterInterlinks,
} from '../content-cluster';
import {
  createWordPressPost,
  findOrCreateCategory,
  isWordPressConfigured,
  pieceContentToHtml,
  resolveCoverUploadBuffer,
  resolveWordPressConfig,
  resolveWordPressPublicUrl,
  testWordPressConnection,
  trashWordPressPost,
  updateWordPressPost,
  uploadWordPressMedia,
} from './wordpress';
import { submitUrlAfterPublishSafe } from './url-submit';

const DEFAULT_CATEGORY = 'Artículos';

type PublishResult = {
  externalId: string;
  url: string;
  status: string;
};

function seoFromPiece(
  piece: Pick<ContentPiece, 'title' | 'seoMeta' | 'keyword'>,
  excerpt?: string,
) {
  const seoMeta = piece.seoMeta as {
    metaTitle?: string;
    metaDescription?: string;
  } | null;
  return {
    metaTitle: seoMeta?.metaTitle ?? piece.title,
    metaDescription: seoMeta?.metaDescription ?? excerpt,
    focusKeyword: piece.keyword ?? undefined,
  };
}

async function uploadFeaturedCoverForPiece(
  config: NonNullable<ReturnType<typeof resolveWordPressConfig>>,
  piece: Pick<ContentPiece, 'id' | 'title' | 'content'>,
): Promise<number | null> {
  const content = piece.content as {
    articleData?: {
      featuredImage?: { url?: string; remoteUrl?: string; alt?: string; source?: string };
    };
  } | null;
  const cover = content?.articleData?.featuredImage;
  if (!cover) return null;

  // Preferir PNG/JPG de DALL·E; si no, intentar SVG (algunos hosts lo rechazan).
  const preferredUrl = cover.remoteUrl || cover.url;
  if (!preferredUrl) return null;

  const resolved = await resolveCoverUploadBuffer(preferredUrl);
  if (!resolved) return null;

  // Si es SVG y el host suele bloquearlo, igual intentamos; fallará soft.
  const filename = `teo-cover-${piece.id.slice(0, 8)}.${resolved.ext}`;
  const media = await uploadWordPressMedia(config, {
    buffer: resolved.buffer,
    filename,
    contentType: resolved.contentType,
    alt: cover.alt || piece.title,
    title: `Portada — ${piece.title}`.slice(0, 120),
  });
  return media.id;
}

/** Publica en WP y persiste Publication / refresco — usado por aprobaciones y autopublicación. */
export async function publishAndRecordPiece(
  workspaceSlug: string,
  workspaceId: string,
  piece: Pick<
    ContentPiece,
    'id' | 'title' | 'slug' | 'content' | 'seoMeta' | 'keyword' | 'clusterId'
  >,
  options?: { wpStatus?: 'draft' | 'publish' },
): Promise<PublishResult> {
  const prepared = await preparePieceHtmlWithInterlinks(workspaceSlug, workspaceId, piece);
  const pieceContent = prepared.content as {
    refreshOfPieceId?: string;
    excerpt?: string;
  } | null;
  const refreshOfPieceId = pieceContent?.refreshOfPieceId;

  const wpResult = await publishPieceToWordPress(workspaceSlug, prepared, {
    status: options?.wpStatus ?? 'publish',
  });

  if (refreshOfPieceId) {
    // publishRefreshPieceToWordPress ya actualizó Publication de la pieza original
    if (wpResult.status === 'publish' && wpResult.url) {
      const originalId = refreshOfPieceId;
      void submitUrlAfterPublishSafe(workspaceSlug, {
        url: wpResult.url,
        pieceId: originalId,
        wpStatus: wpResult.status,
      });
    }
    return wpResult;
  }

  await prisma.$transaction([
    prisma.contentPiece.update({
      where: { id: piece.id },
      data: { status: 'published' },
    }),
    prisma.publication.upsert({
      where: { pieceId: piece.id },
      create: {
        workspaceId,
        pieceId: piece.id,
        externalId: wpResult.externalId,
        url: wpResult.url,
        publishedAt: new Date(),
      },
      update: {
        externalId: wpResult.externalId,
        url: wpResult.url,
        publishedAt: new Date(),
      },
    }),
  ]);

  if (wpResult.status === 'publish' && wpResult.url) {
    void submitUrlAfterPublishSafe(workspaceSlug, {
      url: wpResult.url,
      pieceId: piece.id,
      wpStatus: wpResult.status,
    });
  }

  return wpResult;
}

async function preparePieceHtmlWithInterlinks(
  workspaceSlug: string,
  workspaceId: string,
  piece: Pick<
    ContentPiece,
    'id' | 'title' | 'slug' | 'content' | 'seoMeta' | 'keyword' | 'clusterId'
  >,
) {
  const content = piece.content as { html?: string; markdown?: string; excerpt?: string } | null;
  if (!content?.html) return piece;

  const clusterId = piece.clusterId ?? (await ensureDefaultCluster(workspaceSlug)).id;
  if (!piece.clusterId) {
    await prisma.contentPiece.update({
      where: { id: piece.id },
      data: { clusterId },
    });
  }

  const { html } = await enrichHtmlWithClusterInterlinks(workspaceId, clusterId, content.html, {
    excludePieceId: piece.id,
    excludeSlug: piece.slug ?? undefined,
  });

  return {
    ...piece,
    clusterId,
    content: { ...content, html },
  };
}

export async function publishPieceToWordPress(
  workspaceSlug: string,
  piece: Pick<
    ContentPiece,
    'id' | 'title' | 'slug' | 'content' | 'seoMeta' | 'keyword' | 'clusterId'
  >,
  options?: { status?: 'draft' | 'publish' | 'pending' },
): Promise<PublishResult> {
  const pieceContent = piece.content as {
    refreshOfPieceId?: string;
    markdown?: string;
    html?: string;
    excerpt?: string;
  } | null;

  if (pieceContent?.refreshOfPieceId) {
    return publishRefreshPieceToWordPress(
      workspaceSlug,
      piece,
      pieceContent.refreshOfPieceId,
      options,
    );
  }

  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error(
      `WordPress no configurado para workspace "${workspaceSlug}". Definí WORDPRESS_URL, WORDPRESS_USERNAME y WORDPRESS_APP_PASSWORD.`,
    );
  }

  const content = pieceContent;
  const seoMeta = piece.seoMeta as { slug?: string; metaDescription?: string; canonical?: string } | null;
  const slug = piece.slug ?? seoMeta?.slug;
  const wpStatus = options?.status ?? config.approvalPostStatus ?? 'draft';

  let categoryId = config.defaultCategoryId;
  if (!categoryId) {
    try {
      categoryId = await findOrCreateCategory(config, DEFAULT_CATEGORY);
    } catch {
      // publicar sin categoría si falla
    }
  }

  let featuredMediaId: number | undefined;
  try {
    featuredMediaId = await uploadFeaturedCoverForPiece(config, piece) ?? undefined;
  } catch (err) {
    console.warn(
      '[wordpress] featured cover omitida:',
      err instanceof Error ? err.message : err,
    );
  }

  const wpPost = await createWordPressPost(config, {
    title: piece.title,
    content: pieceContentToHtml(content),
    excerpt: content?.excerpt ?? seoMeta?.metaDescription,
    slug,
    status: wpStatus,
    categories: categoryId ? [categoryId] : undefined,
    featuredMediaId,
    seoMeta: seoFromPiece(piece, content?.excerpt ?? seoMeta?.metaDescription),
  });

  const publicUrl = resolveWordPressPublicUrl(
    config,
    wpPost,
    slug,
    seoMeta?.canonical,
  );

  return {
    externalId: String(wpPost.id),
    url: publicUrl,
    status: wpPost.status,
  };
}

/** Actualiza el post WP existente cuando se aprueba un refresco de contenido. */
export async function publishRefreshPieceToWordPress(
  workspaceSlug: string,
  refreshPiece: Pick<
    ContentPiece,
    'id' | 'title' | 'slug' | 'content' | 'seoMeta' | 'keyword' | 'clusterId'
  >,
  originalPieceId: string,
  options?: { status?: 'draft' | 'publish' | 'pending' },
): Promise<PublishResult> {
  const original = await prisma.contentPiece.findUnique({
    where: { id: originalPieceId },
    include: { publication: true },
  });

  if (!original?.publication?.externalId) {
    throw new Error('Pieza original sin publicación en WordPress para refrescar');
  }

  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error(`WordPress no configurado para workspace "${workspaceSlug}"`);
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  let content = refreshPiece.content as {
    markdown?: string;
    html?: string;
    excerpt?: string;
  } | null;

  if (content?.html && workspace) {
    const clusterId =
      refreshPiece.clusterId ??
      original.clusterId ??
      (await ensureDefaultCluster(workspaceSlug)).id;
    const { html } = await enrichHtmlWithClusterInterlinks(workspace.id, clusterId, content.html, {
      excludePieceId: originalPieceId,
      excludeSlug: original.slug ?? undefined,
    });
    content = { ...content, html };
  }

  const seoMeta = refreshPiece.seoMeta as { slug?: string; metaDescription?: string; canonical?: string } | null;
  const slug = original.slug ?? refreshPiece.slug ?? seoMeta?.slug;
  const wpStatus = options?.status ?? config.approvalPostStatus ?? 'publish';

  const wpPost = await updateWordPressPost(config, Number(original.publication.externalId), {
    title: refreshPiece.title,
    content: pieceContentToHtml(content),
    excerpt: content?.excerpt ?? seoMeta?.metaDescription,
    slug,
    status: wpStatus,
    seoMeta: seoFromPiece(refreshPiece, content?.excerpt ?? seoMeta?.metaDescription),
  });

  const publicUrl = resolveWordPressPublicUrl(
    config,
    wpPost,
    slug,
    seoMeta?.canonical ?? original.publication.url ?? undefined,
  );

  await prisma.$transaction([
    prisma.contentPiece.update({
      where: { id: originalPieceId },
      data: {
        title: refreshPiece.title,
        slug,
        status: 'published',
        content: {
          markdown: content?.markdown,
          html: content?.html,
          excerpt: content?.excerpt,
        },
        seoMeta: refreshPiece.seoMeta ?? undefined,
      },
    }),
    prisma.publication.update({
      where: { pieceId: originalPieceId },
      data: {
        url: publicUrl,
        publishedAt: new Date(),
      },
    }),
    prisma.contentPiece.update({
      where: { id: refreshPiece.id },
      data: { status: 'archived' },
    }),
  ]);

  return {
    externalId: String(wpPost.id),
    url: publicUrl,
    status: wpPost.status,
  };
}

/**
 * Empuja el HTML actual de una pieza ya publicada a su post de WordPress.
 * Sirve para propagar cambios de diseño/branding sin crear una publicación nueva.
 */
export async function resyncPublishedPieceToWordPress(
  workspaceSlug: string,
  pieceId: string,
): Promise<PublishResult> {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: pieceId },
    include: { publication: true, workspace: true },
  });

  if (!piece) throw new Error('Pieza no encontrada');
  if (!piece.publication?.externalId) {
    throw new Error('La pieza no tiene publicación en WordPress para actualizar');
  }

  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error(`WordPress no configurado para workspace "${workspaceSlug}"`);
  }

  const prepared = await preparePieceHtmlWithInterlinks(workspaceSlug, piece.workspaceId, piece);
  const content = prepared.content as { html?: string; markdown?: string; excerpt?: string } | null;
  const seoMeta = piece.seoMeta as { slug?: string; metaDescription?: string; canonical?: string } | null;
  const slug = piece.slug ?? seoMeta?.slug;

  const wpPost = await updateWordPressPost(config, Number(piece.publication.externalId), {
    title: piece.title,
    content: pieceContentToHtml(content),
    excerpt: content?.excerpt ?? seoMeta?.metaDescription,
    slug,
    seoMeta: seoFromPiece(piece, content?.excerpt ?? seoMeta?.metaDescription),
  });

  return {
    externalId: String(wpPost.id),
    url: resolveWordPressPublicUrl(config, wpPost, slug, seoMeta?.canonical ?? piece.publication.url),
    status: wpPost.status,
  };
}

/** Republica un post ya creado (ej. quedó en draft) y devuelve URL pública. */
export async function publishExistingWordPressPost(
  workspaceSlug: string,
  externalId: string,
  piece: Pick<ContentPiece, 'slug' | 'seoMeta'>,
): Promise<PublishResult> {
  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error(`WordPress no configurado para workspace "${workspaceSlug}"`);
  }

  const seoMeta = piece.seoMeta as { slug?: string; canonical?: string } | null;
  const slug = piece.slug ?? seoMeta?.slug;

  const wpPost = await updateWordPressPost(config, Number(externalId), {
    status: 'publish',
    slug,
  });

  return {
    externalId: String(wpPost.id),
    url: resolveWordPressPublicUrl(config, wpPost, slug, seoMeta?.canonical),
    status: wpPost.status,
  };
}

export function getWordPressStatus(workspaceSlug: string) {
  const config = resolveWordPressConfig(workspaceSlug);
  return {
    configured: isWordPressConfigured(config),
    baseUrl: config?.baseUrl ?? null,
    approvalPostStatus: config?.approvalPostStatus ?? null,
    authorDisplayName: config?.authorDisplayName ?? 'Teo',
  };
}

export async function testWorkspaceWordPress(workspaceSlug: string) {
  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    return { configured: false, connected: false, error: 'Credenciales no configuradas' };
  }

  try {
    const result = await testWordPressConnection(config);
    return { configured: true, connected: true, ...result };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Error de conexión',
    };
  }
}

export type ArchivePieceResult = {
  pieceId: string;
  status: 'archived';
  wordpressTrashed: boolean;
  wordpressWarning?: string;
};

/**
 * Soft-archive en Teo + trash en WP si hay publication.externalId.
 * No borra el registro: queda en archived para auditoría / restore futuro.
 */
export async function archivePieceWithWordPressTrash(
  workspaceSlug: string,
  pieceId: string,
  opts?: { workspaceId?: string },
): Promise<ArchivePieceResult> {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: pieceId },
    include: {
      publication: true,
      workspace: { select: { id: true, slug: true } },
    },
  });

  if (!piece) throw new Error('Pieza no encontrada');
  if (opts?.workspaceId && piece.workspaceId !== opts.workspaceId) {
    throw new Error('La pieza no pertenece a tu workspace');
  }
  if (piece.workspace.slug !== workspaceSlug) {
    throw new Error('La pieza no pertenece a ese workspace');
  }

  if (piece.status === 'archived') {
    return {
      pieceId: piece.id,
      status: 'archived',
      wordpressTrashed: false,
      wordpressWarning: 'Ya estaba archivada',
    };
  }

  let wordpressTrashed = false;
  let wordpressWarning: string | undefined;

  const externalId = piece.publication?.externalId;
  if (externalId) {
    const config = resolveWordPressConfig(workspaceSlug);
    if (isWordPressConfigured(config)) {
      try {
        await trashWordPressPost(config, Number(externalId));
        wordpressTrashed = true;
      } catch (err) {
        wordpressWarning =
          err instanceof Error ? err.message.slice(0, 200) : 'No se pudo enviar a papelera WP';
        console.warn('[wordpress] trash falló:', wordpressWarning);
      }
    } else {
      wordpressWarning = 'WordPress no configurado; solo se archivó en Teo';
    }
  }

  await prisma.contentPiece.update({
    where: { id: piece.id },
    data: { status: 'archived' },
  });

  return {
    pieceId: piece.id,
    status: 'archived',
    wordpressTrashed,
    wordpressWarning,
  };
}
