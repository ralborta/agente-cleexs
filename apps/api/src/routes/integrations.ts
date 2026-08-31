import type { FastifyPluginAsync } from 'fastify';
import { getGoogleMetricsStatus } from '../lib/integrations/google-config';
import { testGoogleMetrics, syncWorkspaceMetrics } from '../lib/metrics-sync';
import { getWordPressStatus, testWorkspaceWordPress } from '../lib/integrations/wordpress-publish';
import { auditWordPressSetup } from '../lib/integrations/wordpress-setup';
import { auditSeoFoundations, publishLlmsTxt } from '../lib/integrations/seo-foundations';
import {
  applyHomeSeoMeta,
  isWordPressConfigured,
  protectWordPressHeaderIdentity,
  resolveWordPressConfig,
} from '../lib/integrations/wordpress';
import {
  HOME_SEO_DESCRIPTION,
  HOME_SEO_TITLE,
  resolveHeaderSiteName,
  WP_HEADER_HOME_NAV_TITLE,
} from '../lib/integrations/wordpress-seo';
import { getAutomationStatus } from '../lib/automation-status';
import { getWorkspaceIndexingStatus, invalidateIndexingCache } from '../lib/indexing-status';
import {
  ensureIndexNowKeyFile,
  submitPendingUrls,
  submitUrlForIndexing,
} from '../lib/integrations/url-submit';
import { runSchedulerTick } from '../lib/job-scheduler';
import {
  applyRefreshScan,
  getRefresherStatus,
  scanWorkspaceRefreshCandidates,
  spawnRefreshMission,
  retryRefreshMissionForPiece,
} from '../lib/refresher-scan';
import { prisma } from '../lib/prisma';

const integrationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/:workspaceSlug/overview', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };

    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }

    const [integrations, automation] = await Promise.all([
      prisma.integration.findMany({ where: { workspaceId: workspace.id } }),
      getAutomationStatus(workspaceSlug),
    ]);

    const wpRow = integrations.find((i) => i.type === 'wordpress');
    const gscRow = integrations.find((i) => i.type === 'google_search_console');
    const ga4Row = integrations.find((i) => i.type === 'google_analytics');

    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      wordpress: getWordPressStatus(workspaceSlug),
      google: getGoogleMetricsStatus(workspaceSlug),
      integrations: {
        wordpress: wpRow
          ? { status: wpRow.status, updatedAt: wpRow.updatedAt.toISOString() }
          : null,
        gsc: gscRow
          ? { status: gscRow.status, updatedAt: gscRow.updatedAt.toISOString(), config: gscRow.config }
          : null,
        ga4: ga4Row
          ? { status: ga4Row.status, updatedAt: ga4Row.updatedAt.toISOString(), config: ga4Row.config }
          : null,
      },
      automation,
      refresher: getRefresherStatus(workspaceSlug),
    };
  });

  server.get('/:workspaceSlug/wordpress', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const status = getWordPressStatus(workspaceSlug);
    return { workspace: workspaceSlug, wordpress: status };
  });

  server.post('/:workspaceSlug/wordpress/test', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const result = await testWorkspaceWordPress(workspaceSlug);
    return { workspace: workspaceSlug, wordpress: result };
  });

  server.get('/:workspaceSlug/wordpress/setup', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const report = await auditWordPressSetup(workspaceSlug);
    return { workspace: workspaceSlug, setup: report };
  });

  server.post('/:workspaceSlug/wordpress/header-identity', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const config = resolveWordPressConfig(workspaceSlug);
    if (!isWordPressConfigured(config)) {
      return reply.status(400).send({ error: 'WordPress no configurado' });
    }
    try {
      const identity = {
        siteName: resolveHeaderSiteName(workspaceSlug),
        homeNavTitle: WP_HEADER_HOME_NAV_TITLE,
      };
      const header = await protectWordPressHeaderIdentity(config, identity);
      const setup = await auditWordPressSetup(workspaceSlug);
      return { workspace: workspaceSlug, header, setup };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al restaurar el header';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/seo-foundations/home', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const config = resolveWordPressConfig(workspaceSlug);
    if (!isWordPressConfigured(config)) {
      return reply.status(400).send({ error: 'WordPress no configurado' });
    }
    try {
      const identity = {
        siteName: resolveHeaderSiteName(workspaceSlug),
        homeNavTitle: WP_HEADER_HOME_NAV_TITLE,
      };
      // Copy SEO largo de home solo para Cleexs; otros workspaces solo protegen el header.
      const header =
        workspaceSlug === 'cleexs'
          ? await applyHomeSeoMeta(
              config,
              { metaTitle: HOME_SEO_TITLE, metaDescription: HOME_SEO_DESCRIPTION },
              identity,
            )
          : await protectWordPressHeaderIdentity(config, identity);
      return { workspace: workspaceSlug, header };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al aplicar SEO de la home';
      return reply.status(502).send({ error: message });
    }
  });

  server.get('/:workspaceSlug/seo-foundations', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      const report = await auditSeoFoundations(workspaceSlug);
      return { workspace: workspaceSlug, foundations: report };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al auditar fundaciones SEO';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/seo-foundations/llms', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      const result = await publishLlmsTxt(workspaceSlug);
      const foundations = await auditSeoFoundations(workspaceSlug);
      return { workspace: workspaceSlug, ...result, foundations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar llms.txt';
      return reply.status(502).send({ error: message });
    }
  });

  server.get('/:workspaceSlug/google', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    return { workspace: workspaceSlug, google: getGoogleMetricsStatus(workspaceSlug) };
  });

  server.post('/:workspaceSlug/google/test', async (request) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const result = await testGoogleMetrics(workspaceSlug);
    return { workspace: workspaceSlug, google: result };
  });

  server.get('/:workspaceSlug/indexing', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const { force } = request.query as { force?: string };
    try {
      const report = await getWorkspaceIndexingStatus(workspaceSlug, { force: force === 'true' });
      return { workspace: workspaceSlug, indexing: report };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al verificar indexación';
      return reply.status(502).send({ error: message });
    }
  });

  /** Sprint 5.2 — solicitar indexación (GSC Indexing API + IndexNow) */
  server.post('/:workspaceSlug/indexing/submit', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const body = (request.body as {
      pieceId?: string;
      url?: string;
      pending?: boolean;
      onlyNotSubmitted?: boolean;
      limit?: number;
    }) ?? {};

    try {
      if (body.pending) {
        const result = await submitPendingUrls(workspaceSlug, {
          onlyNotSubmitted: body.onlyNotSubmitted ?? true,
          limit: body.limit ?? 20,
        });
        invalidateIndexingCache(workspaceSlug);
        return { workspace: workspaceSlug, ...result };
      }

      let url = body.url?.trim();
      let pieceId = body.pieceId;

      if (pieceId && !url) {
        const pub = await prisma.publication.findUnique({ where: { pieceId } });
        url = pub?.url ?? undefined;
      }
      if (!url) {
        return reply.status(400).send({ error: 'url o pieceId requerido' });
      }

      const result = await submitUrlForIndexing(workspaceSlug, { url, pieceId });
      invalidateIndexingCache(workspaceSlug);
      return { workspace: workspaceSlug, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al submitear URL';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/indexing/indexnow-key', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      const result = await ensureIndexNowKeyFile(workspaceSlug);
      return { workspace: workspaceSlug, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al publicar IndexNow key';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/metrics-sync', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      const result = await syncWorkspaceMetrics(workspaceSlug);
      const automation = await getAutomationStatus(workspaceSlug);
      return { ...result, automation };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en sync de métricas';
      return reply.status(502).send({ error: message });
    }
  });

  server.get('/:workspaceSlug/refresher', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }
    return { workspace: workspaceSlug, refresher: getRefresherStatus(workspaceSlug) };
  });

  server.post('/:workspaceSlug/refresher-scan', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const { spawn } = (request.body as { spawn?: boolean }) ?? {};
    try {
      const scan = await applyRefreshScan(workspaceSlug);
      const mission = spawn
        ? await spawnRefreshMission(workspaceSlug, scan.topCandidate ?? undefined)
        : null;
      return { ...scan, mission };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en escaneo refrescador';
      return reply.status(502).send({ error: message });
    }
  });

  server.get('/:workspaceSlug/refresher-candidates', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    try {
      return await scanWorkspaceRefreshCandidates(workspaceSlug);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al listar candidatos';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/refresher-retry', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    const { pieceId } = (request.body as { pieceId?: string }) ?? {};
    if (!pieceId) {
      return reply.status(400).send({ error: 'pieceId requerido' });
    }
    try {
      const mission = await retryRefreshMissionForPiece(workspaceSlug, pieceId);
      return { workspace: workspaceSlug, pieceId, mission };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al reintentar refresco';
      return reply.status(502).send({ error: message });
    }
  });

  server.post('/:workspaceSlug/trigger-scheduler', async (request, reply) => {
    const { workspaceSlug } = request.params as { workspaceSlug: string };
    if (!request.authUser) {
      return reply.status(401).send({ error: 'Autenticación requerida' });
    }
    if (request.authUser.workspaceSlug !== workspaceSlug && request.authUser.role !== 'admin') {
      return reply.status(403).send({ error: 'Sin acceso a este workspace' });
    }
    const workspace = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace no encontrado' });
    }
    try {
      const result = await runSchedulerTick();
      const automation = await getAutomationStatus(workspaceSlug);
      return { ok: true, workspace: workspaceSlug, result, automation };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al ejecutar scheduler';
      return reply.status(502).send({ error: message });
    }
  });
};

export default integrationRoutes;
