import type { ContentPiece } from '@prisma/client';
import {
  createWordPressPost,
  findOrCreateCategory,
  isWordPressConfigured,
  pieceContentToHtml,
  resolveWordPressConfig,
  testWordPressConnection,
} from './wordpress';

const DEFAULT_CATEGORY = 'Artículos';

type PublishResult = {
  externalId: string;
  url: string;
  status: string;
};

export async function publishPieceToWordPress(
  workspaceSlug: string,
  piece: Pick<ContentPiece, 'title' | 'slug' | 'content' | 'seoMeta'>,
  options?: { status?: 'draft' | 'publish' | 'pending' },
): Promise<PublishResult> {
  const config = resolveWordPressConfig(workspaceSlug);
  if (!isWordPressConfigured(config)) {
    throw new Error(
      `WordPress no configurado para workspace "${workspaceSlug}". Definí WORDPRESS_URL, WORDPRESS_USERNAME y WORDPRESS_APP_PASSWORD.`,
    );
  }

  const content = piece.content as { markdown?: string; html?: string; excerpt?: string } | null;
  const seoMeta = piece.seoMeta as { slug?: string; metaDescription?: string } | null;

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
    slug: piece.slug ?? seoMeta?.slug,
    status: options?.status ?? config.approvalPostStatus ?? 'draft',
    categories: categoryId ? [categoryId] : undefined,
  });

  return {
    externalId: String(wpPost.id),
    url: wpPost.link,
    status: wpPost.status,
  };
}

export function getWordPressStatus(workspaceSlug: string) {
  const config = resolveWordPressConfig(workspaceSlug);
  return {
    configured: isWordPressConfigured(config),
    baseUrl: config?.baseUrl ?? null,
    approvalPostStatus: config?.approvalPostStatus ?? null,
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
