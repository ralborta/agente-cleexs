import type { ContentPiece } from '@prisma/client';
import { prisma } from '../prisma';
import {
  createWordPressPost,
  findOrCreateCategory,
  isWordPressConfigured,
  pieceContentToHtml,
  resolveWordPressConfig,
  resolveWordPressPublicUrl,
  testWordPressConnection,
  updateWordPressPost,
} from './wordpress';

const DEFAULT_CATEGORY = 'Artículos';

type PublishResult = {
  externalId: string;
  url: string;
  status: string;
};

export async function publishPieceToWordPress(
  workspaceSlug: string,
  piece: Pick<ContentPiece, 'id' | 'title' | 'slug' | 'content' | 'seoMeta'>,
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

  const wpPost = await createWordPressPost(config, {
    title: piece.title,
    content: pieceContentToHtml(content),
    excerpt: content?.excerpt ?? seoMeta?.metaDescription,
    slug,
    status: wpStatus,
    categories: categoryId ? [categoryId] : undefined,
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
  refreshPiece: Pick<ContentPiece, 'id' | 'title' | 'slug' | 'content' | 'seoMeta'>,
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

  const content = refreshPiece.content as { markdown?: string; html?: string; excerpt?: string } | null;
  const seoMeta = refreshPiece.seoMeta as { slug?: string; metaDescription?: string; canonical?: string } | null;
  const slug = original.slug ?? refreshPiece.slug ?? seoMeta?.slug;
  const wpStatus = options?.status ?? config.approvalPostStatus ?? 'publish';

  const wpPost = await updateWordPressPost(config, Number(original.publication.externalId), {
    title: refreshPiece.title,
    content: pieceContentToHtml(content),
    excerpt: content?.excerpt ?? seoMeta?.metaDescription,
    slug,
    status: wpStatus,
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
