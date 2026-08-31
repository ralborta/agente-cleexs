import type { ContentPiece } from '@prisma/client';
import { renderArticleHtml, type ArticleData, type ArticleSection, articleToMarkdown } from './agents/teo/article-template';
import {
  buildSeoSchemaGraph,
  collectArticleFaqs,
  injectJsonLd,
} from './agents/teo/aeo-checklist';
import { sanitizeChartSpec } from './agents/teo/charts';
import { resolveBrandKit } from './branding/brand-kit';
import { prisma } from './prisma';
import { resolveSiteBaseUrl } from './integrations/wordpress';

function renderWithTracking(
  articleData: ArticleData,
  branding: ReturnType<typeof resolveBrandKit>,
  opts: { pieceId?: string; workspaceSlug?: string },
) {
  return renderArticleHtml(articleData, branding, {
    pieceId: opts.pieceId,
    workspaceSlug: opts.workspaceSlug,
    trackBaseUrl: process.env.API_PUBLIC_URL,
  });
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type PieceContent = {
  markdown?: string;
  html?: string;
  excerpt?: string;
  /** Estructura original del artículo (secciones, tablas, gráficos, referencias). */
  articleData?: ArticleData;
};

type PieceSeoMeta = {
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonical?: string;
};

export function parsePieceContent(content: unknown): PieceContent {
  if (!content || typeof content !== 'object') return {};
  return content as PieceContent;
}

export function parsePieceSeoMeta(seoMeta: unknown): PieceSeoMeta {
  if (!seoMeta || typeof seoMeta !== 'object') return {};
  return seoMeta as PieceSeoMeta;
}

/** Regenera HTML del artículo tras editar título, extracto o markdown. */
export function rebuildPieceHtml(
  piece: Pick<ContentPiece, 'title' | 'type' | 'keyword'>,
  content: PieceContent,
  branding: ReturnType<typeof resolveBrandKit>,
): string {
  const lead = content.excerpt?.trim() || ' ';
  const markdown = content.markdown?.trim() || '';

  const sections = markdown
    ? markdown
        .split(/\n(?=## )/)
        .filter(Boolean)
        .map((block) => {
          const lines = block.trim().split('\n');
          const headingMatch = lines[0]?.match(/^## (.+)/);
          if (headingMatch) {
            return {
              heading: headingMatch[1],
              body: lines.slice(1).join('\n').trim(),
            };
          }
          return { body: block.trim() };
        })
    : [{ body: lead }];

  const articleData: ArticleData = {
    kicker: piece.keyword?.trim() || piece.title.split(' ').slice(0, 3).join(' '),
    title: piece.title,
    lead,
    sections,
    pieceType: piece.type,
  };

  return renderWithTracking(articleData, branding, {});
}

function extractLeadFromMarkdown(markdown?: string): string | null {
  if (!markdown) return null;
  const body = markdown.replace(/^#\s+.*(\r?\n)+/, '');
  const first = body.split(/\n{2,}/)[0]?.trim();
  return first && !first.startsWith('#') ? first : null;
}

/**
 * Repara entradillas que quedaron recortadas cuando editar el título las
 * pisaba con el excerpt. El markdown conserva el texto original, así que se
 * restaura solo si lo guardado es un prefijo exacto de aquel.
 */
function recoverLead(lead: string, markdown?: string): string {
  const original = extractLeadFromMarkdown(markdown);
  if (!original) return lead;
  const stored = lead.replace(/…$/, '').trim();
  return original.startsWith(stored) && original.length > stored.length ? original : lead;
}

function sanitizeIncomingArticleData(
  raw: ArticleData,
  fallback: ArticleData,
  title: string,
  pieceType: string,
): ArticleData {
  const sections: ArticleSection[] = (raw.sections ?? []).map((section) => ({
    ...section,
    heading: section.heading?.slice(0, 300),
    body: section.body,
    items: section.items?.slice(0, 40),
    faqs: section.faqs?.slice(0, 30),
    examples: section.examples?.slice(0, 20),
    callout: section.callout?.slice(0, 5000),
    table: section.table
      ? {
          headers: (section.table.headers ?? []).slice(0, 12).map((h) => String(h).slice(0, 120)),
          rows: (section.table.rows ?? [])
            .slice(0, 40)
            .map((row) => (row ?? []).slice(0, 12).map((c) => String(c).slice(0, 500))),
        }
      : undefined,
    chart: section.chart ? sanitizeChartSpec(section.chart) ?? undefined : undefined,
  }));

  return {
    ...fallback,
    ...raw,
    title,
    lead: (raw.lead ?? fallback.lead).slice(0, 5000),
    kicker: (raw.kicker ?? fallback.kicker).slice(0, 120),
    pieceType: raw.pieceType || pieceType,
    sections: sections.length ? sections : fallback.sections,
    references: (raw.references ?? fallback.references)?.slice(0, 20),
    ctaVariant: raw.ctaVariant === 'B' || raw.ctaVariant === 'A' ? raw.ctaVariant : fallback.ctaVariant,
  };
}

/**
 * Vuelve a generar el HTML de una pieza desde su estructura guardada, aplicando
 * el diseño/branding actual. Sirve para aplicar un template nuevo a piezas ya
 * escritas sin volver a pagar una generación con el LLM.
 */
export async function rerenderPieceFromArticleData(
  pieceId: string,
  opts?: { workspaceId?: string },
) {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: pieceId },
    include: { workspace: true },
  });

  if (!piece) {
    throw new Error('Pieza no encontrada');
  }
  if (opts?.workspaceId && piece.workspaceId !== opts.workspaceId) {
    throw new Error('La pieza no pertenece a tu workspace');
  }

  const content = parsePieceContent(piece.content);
  if (!content.articleData?.sections?.length) {
    throw new Error(
      'La pieza no tiene estructura guardada (articleData): se generó antes de persistirla. Hay que regenerarla para poder re-renderizarla.',
    );
  }

  const agentConfig = await prisma.agentConfig.findFirst({
    where: { workspaceId: piece.workspaceId, agent: { slug: 'teo' } },
  });
  const branding = resolveBrandKit(agentConfig?.branding, piece.workspace.name);

  const articleData: ArticleData = {
    ...content.articleData,
    title: piece.title,
    lead: recoverLead(content.articleData.lead, content.markdown),
    publishedAt: content.articleData.publishedAt ?? piece.createdAt.toISOString(),
  };
  let html = renderWithTracking(articleData, branding, {
    pieceId: piece.id,
    workspaceSlug: piece.workspace.slug,
  });
  const faqs = collectArticleFaqs(articleData);
  const schema = buildSeoSchemaGraph({
    title: piece.title,
    description: content.excerpt || articleData.lead,
    pieceType: piece.type,
    faqs,
    brandName: branding.brandName,
  });
  html = injectJsonLd(html, schema);

  const updated = await prisma.contentPiece.update({
    where: { id: pieceId },
    data: {
      content: { ...content, articleData, html },
      seoMeta: {
        ...(typeof piece.seoMeta === 'object' && piece.seoMeta ? piece.seoMeta : {}),
        schema,
        faqCount: faqs.length,
      },
    },
  });

  return updated;
}

export type UpdateApprovalPieceInput = {
  title?: string;
  excerpt?: string;
  markdown?: string;
  /** Edición estructurada: preserva tablas, gráficos, FAQs, etc. */
  articleData?: ArticleData;
};

function buildExcerptFromLead(lead: string, max = 220): string {
  const clean = lead.replace(/^Respuesta directa:\s*/i, '').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.–-]+$/, '')}…`;
}

export async function updateApprovalPieceContent(
  approvalId: string,
  input: UpdateApprovalPieceInput,
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: {
      piece: true,
      workspace: true,
    },
  });

  if (!approval) {
    throw new Error('Aprobación no encontrada');
  }
  if (approval.status !== 'pending') {
    throw new Error('Solo se pueden editar piezas con aprobación pendiente');
  }

  const agentConfig = await prisma.agentConfig.findFirst({
    where: {
      workspaceId: approval.workspaceId,
      agent: { slug: 'teo' },
    },
  });

  const branding = resolveBrandKit(agentConfig?.branding, approval.workspace.name);
  const siteBase = resolveSiteBaseUrl(approval.workspace.slug);
  const currentContent = parsePieceContent(approval.piece.content);
  const currentSeo = parsePieceSeoMeta(approval.piece.seoMeta);

  const title = input.title?.trim() || approval.piece.title;
  const excerpt = input.excerpt !== undefined ? input.excerpt.trim() : currentContent.excerpt;
  const markdown = input.markdown !== undefined ? input.markdown : currentContent.markdown;

  const nextContent: PieceContent = {
    ...currentContent,
    excerpt: excerpt || currentContent.excerpt,
    markdown,
  };

  const structuredIncoming = input.articleData;
  const markdownEdited =
    input.markdown !== undefined && input.markdown !== currentContent.markdown;
  const structured = currentContent.articleData;

  const excerptEdited =
    input.excerpt !== undefined && input.excerpt.trim() !== (currentContent.excerpt ?? '').trim();

  if (structuredIncoming?.sections?.length) {
    const base: ArticleData = structured ?? {
      kicker: approval.piece.keyword?.trim() || title.split(' ').slice(0, 3).join(' '),
      title,
      lead: excerpt || '',
      sections: structuredIncoming.sections,
      pieceType: approval.piece.type,
    };
    const articleData = sanitizeIncomingArticleData(
      {
        ...structuredIncoming,
        title,
        lead: structuredIncoming.lead || excerpt || base.lead,
      },
      base,
      title,
      approval.piece.type,
    );
    if (excerptEdited && input.excerpt) {
      nextContent.excerpt = input.excerpt.trim();
    } else {
      nextContent.excerpt = buildExcerptFromLead(articleData.lead) || nextContent.excerpt;
    }
    nextContent.articleData = articleData;
    nextContent.markdown = articleToMarkdown(articleData);
    let html = renderWithTracking(articleData, branding, {
      pieceId: approval.pieceId,
      workspaceSlug: approval.workspace.slug,
    });
    const faqs = collectArticleFaqs(articleData);
    const schema = buildSeoSchemaGraph({
      title,
      description: nextContent.excerpt || articleData.lead,
      pieceType: approval.piece.type,
      faqs,
      brandName: branding.brandName,
    });
    html = injectJsonLd(html, schema);
    nextContent.html = html;

    const slug = input.title ? slugifyTitle(title) : approval.piece.slug ?? currentSeo.slug;
    const nextSeo = {
      ...currentSeo,
      slug,
      metaTitle: `${title} | ${branding.brandName ?? 'Cleexs'}`,
      metaDescription: nextContent.excerpt ?? currentSeo.metaDescription,
      canonical: slug ? `${siteBase}/articulos/${slug}/` : currentSeo.canonical,
      schema,
      faqCount: faqs.length,
    };

    const piece = await prisma.contentPiece.update({
      where: { id: approval.pieceId },
      data: {
        title,
        slug,
        content: nextContent,
        seoMeta: nextSeo as object,
      },
    });

    return { piece, approval };
  }

  // Si el cuerpo no se editó y tenemos la estructura original, re-renderizamos
  // desde ahí: rebuildPieceHtml solo entiende heading + body, así que usarlo
  // para un simple cambio de título borraría tablas, gráficos y referencias.
  if (!markdownEdited && structured?.sections?.length) {
    const articleData: ArticleData = {
      ...structured,
      title,
      lead: excerptEdited ? input.excerpt!.trim() : structured.lead,
    };
    nextContent.articleData = articleData;
    nextContent.html = renderWithTracking(articleData, branding, {
      pieceId: approval.pieceId,
      workspaceSlug: approval.workspace.slug,
    });
    nextContent.markdown = articleToMarkdown(articleData);
  } else {
    nextContent.html = rebuildPieceHtml({ ...approval.piece, title }, nextContent, branding);
    if (markdownEdited) {
      delete nextContent.articleData;
    }
  }

  const slug = input.title ? slugifyTitle(title) : approval.piece.slug ?? currentSeo.slug;
  const nextSeo: PieceSeoMeta = {
    ...currentSeo,
    slug,
    metaTitle: `${title} | ${branding.brandName ?? 'Cleexs'}`,
    metaDescription: nextContent.excerpt ?? currentSeo.metaDescription,
    canonical: slug ? `${siteBase}/articulos/${slug}/` : currentSeo.canonical,
  };

  const piece = await prisma.contentPiece.update({
    where: { id: approval.pieceId },
    data: {
      title,
      slug,
      content: nextContent,
      seoMeta: nextSeo,
    },
  });

  return { piece, approval };
}
