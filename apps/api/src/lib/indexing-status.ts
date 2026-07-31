import { prisma } from './prisma';
import { inspectUrlIndexStatus, type UrlIndexStatus } from './integrations/google-gsc';
import { isGoogleMetricsConfigured, resolveGoogleMetricsConfig } from './integrations/google-config';

export type IndexingReport = {
  configured: boolean;
  checkedAt: string | null;
  summary: { total: number; indexed: number; pending: number };
  pages: Array<
    UrlIndexStatus & {
      pieceId: string;
      title: string;
      publishedAt: string | null;
    }
  >;
};

const cache = new Map<string, { expires: number; data: IndexingReport }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
/** GSC URL Inspection tiene cuota diaria/por minuto — no disparar más de N en paralelo. */
const CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function getWorkspaceIndexingStatus(
  workspaceSlug: string,
  options?: { force?: boolean },
): Promise<IndexingReport> {
  const cacheKey = workspaceSlug;
  const cached = cache.get(cacheKey);
  if (!options?.force && cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const config = resolveGoogleMetricsConfig(workspaceSlug);
  if (!isGoogleMetricsConfigured(config)) {
    return {
      configured: false,
      checkedAt: null,
      summary: { total: 0, indexed: 0, pending: 0 },
      pages: [],
    };
  }

  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) {
    throw new Error(`Workspace "${workspaceSlug}" no encontrado`);
  }

  const publications = await prisma.publication.findMany({
    where: { workspaceId: workspace.id, url: { not: null } },
    orderBy: { publishedAt: 'desc' },
    include: { piece: { select: { id: true, title: true } } },
  });

  const pages = await mapWithConcurrency(publications, CONCURRENCY, async (pub) => {
    try {
      const status = await inspectUrlIndexStatus(config, pub.url as string);
      return {
        ...status,
        pieceId: pub.piece.id,
        title: pub.piece.title,
        publishedAt: pub.publishedAt?.toISOString() ?? null,
      };
    } catch (err) {
      return {
        url: pub.url as string,
        verdict: 'UNKNOWN' as const,
        coverageState: err instanceof Error ? err.message.slice(0, 120) : 'Error al inspeccionar',
        indexed: false,
        lastCrawlTime: null,
        robotsTxtState: null,
        pieceId: pub.piece.id,
        title: pub.piece.title,
        publishedAt: pub.publishedAt?.toISOString() ?? null,
      };
    }
  });

  const indexed = pages.filter((p) => p.indexed).length;

  const report: IndexingReport = {
    configured: true,
    checkedAt: new Date().toISOString(),
    summary: { total: pages.length, indexed, pending: pages.length - indexed },
    pages,
  };

  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data: report });
  return report;
}
