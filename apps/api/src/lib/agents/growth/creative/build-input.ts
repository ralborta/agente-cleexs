import type { CreativeContentInput } from './types';

type PieceLike = {
  id: string;
  title: string;
  content: unknown;
  seoMeta: unknown;
};

type PublicationLike = {
  id: string;
  url: string | null;
} | null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function extractKeyPoints(content: Record<string, unknown>): string[] {
  const article = asRecord(content.articleData);
  const outline = Array.isArray(article.outline) ? article.outline : [];
  const fromOutline = outline
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const row = asRecord(item);
      return String(row.heading || row.title || row.text || '').trim();
    })
    .filter(Boolean);

  if (fromOutline.length) return fromOutline.slice(0, 7);

  const html = typeof content.html === 'string' ? content.html : '';
  const matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').trim(),
  );
  return matches.filter(Boolean).slice(0, 7);
}

export function buildCreativeInputFromPiece(params: {
  brandId: string;
  piece: PieceLike;
  publication?: PublicationLike;
  defaultCta: string;
}): CreativeContentInput {
  const content = asRecord(params.piece.content);
  const seo = asRecord(params.piece.seoMeta);
  const article = asRecord(content.articleData);
  const summary =
    String(content.excerpt || seo.metaDescription || article.summary || '').trim() ||
    params.piece.title;
  const keyPoints = extractKeyPoints(content);
  const mainInsight =
    String(article.mainInsight || article.hook || keyPoints[0] || summary).trim();

  return {
    contentId: params.piece.id,
    publicationId: params.publication?.id,
    brandId: params.brandId,
    title: params.piece.title,
    summary: summary.slice(0, 500),
    keyPoints,
    mainInsight: mainInsight.slice(0, 280),
    cta: params.defaultCta,
    url: params.publication?.url || '',
    contentType: 'article',
    channel: 'linkedin',
  };
}
