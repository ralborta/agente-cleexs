import { prisma } from './prisma';
import { resolveSiteBaseUrl } from './integrations/wordpress';

export type InterlinkTarget = {
  pieceId: string;
  title: string;
  url: string;
  type: string;
  role: 'pillar' | 'satellite';
};

export type ClusterSummary = {
  id: string;
  name: string;
  pillarTopic: string | null;
  pieces: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    slug: string | null;
    keyword: string | null;
    url: string | null;
    role: 'pillar' | 'satellite';
  }>;
  stats: {
    total: number;
    published: number;
    missingTypes: string[];
  };
};

const ECOSYSTEM_TYPES = ['pillar', 'faq', 'checklist', 'comparison', 'how_to'] as const;

const DEFAULT_CLUSTERS: Record<string, { name: string; pillarTopic: string }> = {
  cleexs: {
    name: 'Visibilidad AEO / SEO',
    pillarTopic: 'visibilidad en IA y SEO para PyMEs',
  },
  empleados: {
    name: 'Marca empleadora / atracción de talento',
    pillarTopic: 'marca empleadora y visibilidad en IA para HR',
  },
};

function pieceRole(type: string): 'pillar' | 'satellite' {
  return type === 'pillar' ? 'pillar' : 'satellite';
}

function resolvePublicUrl(
  publicationUrl: string | null | undefined,
  slug: string | null | undefined,
  siteBase: string,
): string | null {
  if (publicationUrl?.trim()) return publicationUrl.trim();
  if (slug?.trim()) {
    const base = siteBase.replace(/\/$/, '') || 'https://cleexs.net';
    return `${base}/articulos/${slug.replace(/^\/+|\/+$/g, '')}/`;
  }
  return null;
}

export async function ensureDefaultCluster(workspaceSlug: string) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const defaults = DEFAULT_CLUSTERS[workspaceSlug];
  if (!defaults) {
    const existing = await prisma.contentCluster.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return prisma.contentCluster.create({
      data: {
        workspaceId: workspace.id,
        name: 'Ecosistema principal',
        pillarTopic: 'Contenido SEO/AEO',
      },
    });
  }

  let cluster = await prisma.contentCluster.findFirst({
    where: { workspaceId: workspace.id, name: defaults.name },
  });

  if (!cluster) {
    cluster = await prisma.contentCluster.create({
      data: {
        workspaceId: workspace.id,
        name: defaults.name,
        pillarTopic: defaults.pillarTopic,
      },
    });
  }

  return cluster;
}

/** Asigna piezas publicadas (y en cola) sin cluster al ecosistema por defecto. */
export async function bootstrapClusterAssignments(workspaceSlug: string) {
  const cluster = await ensureDefaultCluster(workspaceSlug);
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const unassigned = await prisma.contentPiece.findMany({
    where: {
      workspaceId: workspace.id,
      clusterId: null,
      status: { notIn: ['archived', 'idea'] },
    },
    select: { id: true },
  });

  if (unassigned.length === 0) {
    return { clusterId: cluster.id, assigned: 0 };
  }

  await prisma.contentPiece.updateMany({
    where: { id: { in: unassigned.map((p) => p.id) } },
    data: { clusterId: cluster.id },
  });

  return { clusterId: cluster.id, assigned: unassigned.length };
}

export async function getInterlinkTargets(
  workspaceId: string,
  clusterId: string,
  options?: { excludePieceId?: string; excludeSlug?: string; limit?: number },
): Promise<InterlinkTarget[]> {
  const limit = options?.limit ?? 4;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const siteBase = resolveSiteBaseUrl(workspace?.slug ?? 'cleexs');

  const pieces = await prisma.contentPiece.findMany({
    where: {
      workspaceId,
      clusterId,
      status: { in: ['published', 'refresh_needed'] },
      ...(options?.excludePieceId ? { id: { not: options.excludePieceId } } : {}),
    },
    include: { publication: true },
    orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
  });

  const targets: InterlinkTarget[] = [];

  for (const piece of pieces) {
    const url = resolvePublicUrl(piece.publication?.url, piece.slug, siteBase);
    if (!url) continue;
    if (options?.excludeSlug && piece.slug === options.excludeSlug) continue;

    targets.push({
      pieceId: piece.id,
      title: piece.title,
      url,
      type: piece.type,
      role: pieceRole(piece.type),
    });
  }

  targets.sort((a, b) => {
    if (a.role === 'pillar' && b.role !== 'pillar') return -1;
    if (b.role === 'pillar' && a.role !== 'pillar') return 1;
    return a.title.localeCompare(b.title);
  });

  return targets.slice(0, limit);
}

export function renderInterlinksSection(links: InterlinkTarget[]): string {
  if (!links.length) return '';

  const items = links
    .map((link) => {
      const label = link.role === 'pillar' ? 'Pilar' : link.type.replace(/_/g, ' ');
      return `<li><a href="${escapeAttr(link.url)}" rel="noopener">${escapeHtml(link.title)}</a> <span class="cleexs-ecosystem__tag">${escapeHtml(label)}</span></li>`;
    })
    .join('');

  return `<section class="cleexs-ecosystem"><h2>Artículos que te pueden interesar</h2><p>Más lecturas del blog de Cleexs.</p><ul class="cleexs-ecosystem__list">${items}</ul></section>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

export function injectInterlinksIntoHtml(html: string, links: InterlinkTarget[]): string {
  if (!links.length) return html;

  const section = renderInterlinksSection(links);
  const ecosystemRegex = /<section class="cleexs-ecosystem">[\s\S]*?<\/section>/;

  if (ecosystemRegex.test(html)) {
    return html.replace(ecosystemRegex, section);
  }

  const metaMarker = '<p class="cleexs-meta">';
  if (html.includes(metaMarker)) {
    return html.replace(metaMarker, `${section}\n  ${metaMarker}`);
  }

  const articleClose = '</article>';
  if (html.includes(articleClose)) {
    return html.replace(articleClose, `  ${section}\n${articleClose}`);
  }

  return `${html}\n${section}`;
}

export async function enrichHtmlWithClusterInterlinks(
  workspaceId: string,
  clusterId: string,
  html: string,
  options?: { excludePieceId?: string; excludeSlug?: string },
): Promise<{ html: string; links: InterlinkTarget[] }> {
  const links = await getInterlinkTargets(workspaceId, clusterId, options);
  return { html: injectInterlinksIntoHtml(html, links), links };
}

export async function listWorkspaceClusters(workspaceSlug: string): Promise<ClusterSummary[]> {
  await bootstrapClusterAssignments(workspaceSlug);

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error(`Workspace "${workspaceSlug}" no encontrado`);

  const clusters = await prisma.contentCluster.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'asc' },
    include: {
      pieces: {
        where: { status: { not: 'archived' } },
        include: { publication: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  const siteBase = resolveSiteBaseUrl(workspaceSlug);

  return clusters.map((cluster) => {
    const typesPresent = new Set(cluster.pieces.map((p) => p.type));
    const missingTypes = ECOSYSTEM_TYPES.filter((t) => !typesPresent.has(t));

    return {
      id: cluster.id,
      name: cluster.name,
      pillarTopic: cluster.pillarTopic,
      pieces: cluster.pieces.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        slug: p.slug,
        keyword: p.keyword,
        url: resolvePublicUrl(p.publication?.url, p.slug, siteBase),
        role: pieceRole(p.type),
      })),
      stats: {
        total: cluster.pieces.length,
        published: cluster.pieces.filter((p) => p.status === 'published').length,
        missingTypes,
      },
    };
  });
}

export function getClusterGapPieceTypes(cluster: ClusterSummary): string[] {
  return cluster.stats.missingTypes;
}
