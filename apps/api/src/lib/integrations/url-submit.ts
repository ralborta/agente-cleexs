/**
 * Sprint 5.2 — submitear URLs a Google Indexing API + IndexNow tras publicar/refrescar.
 */
import { prisma } from '../prisma';
import { isGoogleMetricsConfigured, resolveGoogleMetricsConfig } from './google-config';
import { notifyUrlUpdated } from './google-indexing';
import { resolveIndexNowConfig, submitUrlsToIndexNow } from './indexnow';
import { resolveWordPressConfig, upsertWordPressPage, isWordPressConfigured } from './wordpress';

export type UrlSubmitResult = {
  url: string;
  pieceId: string | null;
  gsc: { ok: boolean; skipped?: boolean; detail: string };
  indexNow: { ok: boolean; skipped?: boolean; detail: string };
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Publica/actualiza la página WP que el mu-plugin usa para escribir {key}.txt en la raíz. */
export async function ensureIndexNowKeyFile(workspaceSlug: string): Promise<{
  key: string;
  keyLocation: string;
  pageUrl: string | null;
}> {
  const wp = resolveWordPressConfig(workspaceSlug);
  const site = wp?.baseUrl?.replace(/\/$/, '') || null;
  const cfg = resolveIndexNowConfig(site);
  if (!cfg) {
    throw new Error('INDEXNOW_KEY no configurada (o falta WORDPRESS_URL)');
  }

  let pageUrl: string | null = null;
  if (isWordPressConfigured(wp) && wp) {
    const page = await upsertWordPressPage(wp, {
      slug: 'indexnow-key',
      title: 'IndexNow key',
      content: `<pre class="cleexs-indexnow">${escapeHtml(cfg.key)}</pre>`,
      status: 'publish',
    });
    pageUrl = page.link;
  }

  return { key: cfg.key, keyLocation: cfg.keyLocation, pageUrl };
}

export async function submitUrlForIndexing(
  workspaceSlug: string,
  input: { url: string; pieceId?: string | null },
): Promise<UrlSubmitResult> {
  const url = input.url.trim();
  if (!url) throw new Error('URL requerida');

  const google = resolveGoogleMetricsConfig(workspaceSlug);
  const wp = resolveWordPressConfig(workspaceSlug);
  const site = wp?.baseUrl || (google?.gscSiteUrl?.startsWith('sc-domain:')
    ? `https://${google.gscSiteUrl.replace(/^sc-domain:/, '')}`
    : google?.gscSiteUrl) || null;
  const indexNowCfg = resolveIndexNowConfig(site?.replace(/\/$/, '') ?? null);

  let gsc: UrlSubmitResult['gsc'];
  if (!isGoogleMetricsConfigured(google)) {
    gsc = { ok: false, skipped: true, detail: 'Google / GSC no configurado' };
  } else {
    const res = await notifyUrlUpdated(google, url);
    gsc = { ok: res.ok, skipped: res.skipped, detail: res.detail };
  }

  let indexNow: UrlSubmitResult['indexNow'];
  if (!indexNowCfg) {
    indexNow = {
      ok: false,
      skipped: true,
      detail: 'INDEXNOW_KEY no configurada — setear en Easypanel y publicar key file',
    };
  } else {
    const res = await submitUrlsToIndexNow(indexNowCfg, [url]);
    indexNow = { ok: res.ok, skipped: res.skipped, detail: res.detail };
  }

  const now = new Date();
  if (input.pieceId) {
    await prisma.publication.updateMany({
      where: { pieceId: input.pieceId },
      data: {
        gscSubmittedAt: now,
        gscSubmitStatus: gsc.skipped ? 'skipped' : gsc.ok ? 'ok' : 'error',
        gscSubmitDetail: gsc.detail,
        indexNowSubmittedAt: now,
        indexNowStatus: indexNow.skipped ? 'skipped' : indexNow.ok ? 'ok' : 'error',
        indexNowDetail: indexNow.detail,
      },
    });
  } else {
    await prisma.publication.updateMany({
      where: { url },
      data: {
        gscSubmittedAt: now,
        gscSubmitStatus: gsc.skipped ? 'skipped' : gsc.ok ? 'ok' : 'error',
        gscSubmitDetail: gsc.detail,
        indexNowSubmittedAt: now,
        indexNowStatus: indexNow.skipped ? 'skipped' : indexNow.ok ? 'ok' : 'error',
        indexNowDetail: indexNow.detail,
      },
    });
  }

  return {
    url,
    pieceId: input.pieceId ?? null,
    gsc,
    indexNow,
  };
}

/** Disparo post-publish: no bloquea ni rompe la publicación si falla el submit. */
export async function submitUrlAfterPublishSafe(
  workspaceSlug: string,
  input: { url: string; pieceId: string; wpStatus?: string },
): Promise<UrlSubmitResult | null> {
  if (input.wpStatus && input.wpStatus !== 'publish') {
    return null;
  }
  try {
    return await submitUrlForIndexing(workspaceSlug, {
      url: input.url,
      pieceId: input.pieceId,
    });
  } catch (err) {
    console.warn(
      '[url-submit] post-publish submit failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function submitPendingUrls(
  workspaceSlug: string,
  options?: { limit?: number; onlyNotSubmitted?: boolean },
): Promise<{ submitted: UrlSubmitResult[]; total: number }> {
  const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!workspace) throw new Error('Workspace no encontrado');

  const limit = options?.limit ?? 20;
  const pubs = await prisma.publication.findMany({
    where: {
      workspaceId: workspace.id,
      url: { not: null },
      ...(options?.onlyNotSubmitted
        ? {
            OR: [{ gscSubmittedAt: null }, { indexNowSubmittedAt: null }],
          }
        : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: { url: true, pieceId: true },
  });

  const submitted: UrlSubmitResult[] = [];
  for (const pub of pubs) {
    if (!pub.url) continue;
    submitted.push(
      await submitUrlForIndexing(workspaceSlug, { url: pub.url, pieceId: pub.pieceId }),
    );
  }

  return { submitted, total: submitted.length };
}
