import type {
  GrowthConversationRun,
  GrowthRunTrigger,
  GrowthSerpResultType,
  Prisma,
} from '@prisma/client';
import {
  enqueueAgentJob,
  JOB_GROWTH_CONVERSATION_RUN,
} from '../../../agent-jobs/queue';
import {
  fetchGoogleOrganicSerp,
  resolveDataForSeoConfig,
} from '../../../integrations/dataforseo';
import { prisma } from '../../../prisma';
import {
  parseGrowthConversationsSettings,
  resolveGrowthConversationsConfig,
  wouldExceedSpendLimit,
  type GrowthConversationsConfig,
} from './config';
import { generateReplyDraft } from './drafts';
import { isLikelyConversationUrl } from './filters';
import { extractDomain, isOwnSite, normalizeUrl } from './normalize-url';
import { generateSearchQueries } from './queries';
import { scoreOpportunity } from './score';
import { verifyConversationPage } from './verify';

const TERMINAL_STATUSES = new Set([
  'completed',
  'completed_partial',
  'failed',
  'cancelled',
]);

const REUSE_PAGE_MS = 7 * 24 * 60 * 60 * 1000;

type PieceContent = {
  html?: string;
  markdown?: string;
  excerpt?: string;
};

function mapResultType(t: string): GrowthSerpResultType {
  if (t === 'discussions_and_forums') return 'discussions_and_forums';
  if (t === 'questions_and_answers') return 'questions_and_answers';
  if (t === 'organic') return 'organic';
  return 'other';
}

function normalizeQueryKey(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function isCancelled(runId: string): Promise<boolean> {
  const row = await prisma.growthConversationRun.findUnique({
    where: { id: runId },
    select: { status: true, cancelledAt: true },
  });
  return Boolean(row?.cancelledAt) || row?.status === 'cancelled';
}

async function setProgress(
  runId: string,
  status: GrowthConversationRun['status'],
  progressMessage: string,
  extra?: Prisma.GrowthConversationRunUpdateInput,
): Promise<void> {
  await prisma.growthConversationRun.update({
    where: { id: runId },
    data: { status, progressMessage, ...extra },
  });
}

async function resolveOwnSiteHosts(workspaceId: string): Promise<string[]> {
  const hosts: string[] = [];
  const [discovery, growth, wp] = await Promise.all([
    prisma.agent.findUnique({ where: { slug: 'discovery' } }),
    prisma.agent.findUnique({ where: { slug: 'growth' } }),
    prisma.integration.findFirst({
      where: { workspaceId, type: 'wordpress', status: 'connected' },
    }),
  ]);

  if (discovery) {
    const cfg = await prisma.agentConfig.findUnique({
      where: { workspaceId_agentId: { workspaceId, agentId: discovery.id } },
      select: { settings: true },
    });
    const siteUrl = (cfg?.settings as { siteUrl?: string } | null)?.siteUrl;
    if (siteUrl) hosts.push(siteUrl);
  }
  if (growth) {
    const cfg = await prisma.agentConfig.findUnique({
      where: { workspaceId_agentId: { workspaceId, agentId: growth.id } },
      select: { settings: true },
    });
    const siteUrl = (cfg?.settings as { siteUrl?: string } | null)?.siteUrl;
    if (siteUrl) hosts.push(siteUrl);
  }

  const wpCfg = wp?.config as { siteUrl?: string; url?: string } | null;
  if (wpCfg?.siteUrl) hosts.push(wpCfg.siteUrl);
  if (wpCfg?.url) hosts.push(wpCfg.url);

  return [...new Set(hosts.map((h) => extractDomain(h)).filter(Boolean))];
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function startGrowthConversationRun(input: {
  workspaceId: string;
  pieceId: string;
  trigger: GrowthRunTrigger;
  userId?: string;
  publicationId?: string | null;
}): Promise<GrowthConversationRun> {
  const piece = await prisma.contentPiece.findFirst({
    where: { id: input.pieceId, workspaceId: input.workspaceId },
  });
  if (!piece) throw new Error('ContentPiece no encontrado');

  const config = await resolveGrowthConversationsConfig(input.workspaceId);
  const run = await prisma.growthConversationRun.create({
    data: {
      workspaceId: input.workspaceId,
      pieceId: input.pieceId,
      publicationId: input.publicationId ?? null,
      status: 'queued',
      trigger: input.trigger,
      configSnapshot: config as unknown as Prisma.InputJsonValue,
      costUsd: 0,
      costEstimatedUsd: 0,
      costIsEstimate: true,
      progressMessage: 'En cola',
    },
  });

  await enqueueAgentJob({
    workspaceId: input.workspaceId,
    type: JOB_GROWTH_CONVERSATION_RUN,
    payload: { runId: run.id, userId: input.userId ?? null },
  });

  return run;
}

export async function cancelGrowthConversationRun(
  runId: string,
  workspaceId: string,
): Promise<GrowthConversationRun | null> {
  const run = await prisma.growthConversationRun.findFirst({
    where: { id: runId, workspaceId },
  });
  if (!run) return null;
  if (TERMINAL_STATUSES.has(run.status) && run.status !== 'cancelled') {
    return run;
  }

  // Cancelar jobs pendientes/running de esta ejecución
  const pendingJobs = await prisma.agentJob.findMany({
    where: {
      workspaceId,
      type: JOB_GROWTH_CONVERSATION_RUN,
      status: { in: ['pending', 'running'] },
    },
    take: 50,
  });
  for (const job of pendingJobs) {
    const payload = job.payload as { runId?: string };
    if (payload?.runId === runId) {
      await prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
    }
  }

  return prisma.growthConversationRun.update({
    where: { id: runId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      completedAt: new Date(),
      progressMessage: 'Cancelado',
    },
  });
}

/**
 * Auto-trigger solo si config.autoTriggerOnPublish y hay publicación WP efectiva.
 * Default off.
 */
export async function enqueueGrowthConversationFromPublication(input: {
  workspaceId: string;
  pieceId: string;
  publicationId: string;
}): Promise<GrowthConversationRun | null> {
  const config = await resolveGrowthConversationsConfig(input.workspaceId);
  if (!config.autoTriggerOnPublish) return null;

  const publication = await prisma.publication.findFirst({
    where: {
      id: input.publicationId,
      workspaceId: input.workspaceId,
      pieceId: input.pieceId,
    },
  });
  if (!publication?.publishedAt || !publication.url) return null;

  return startGrowthConversationRun({
    workspaceId: input.workspaceId,
    pieceId: input.pieceId,
    publicationId: input.publicationId,
    trigger: 'auto_publish',
  });
}

export async function executeGrowthConversationRun(runId: string): Promise<GrowthConversationRun> {
  const run = await prisma.growthConversationRun.findUnique({
    where: { id: runId },
    include: {
      piece: true,
      publication: true,
    },
  });
  if (!run) throw new Error('GrowthConversationRun no encontrado');

  if (TERMINAL_STATUSES.has(run.status)) {
    return run;
  }

  const config: GrowthConversationsConfig = run.configSnapshot
    ? parseGrowthConversationsSettings({ conversations: run.configSnapshot })
    : await resolveGrowthConversationsConfig(run.workspaceId);

  let partial = false;
  let hardFail: string | null = null;
  const discardMotives: string[] = [];
  let spentUsd = run.costUsd ?? 0;
  let estimatedUsd = run.costEstimatedUsd ?? 0;
  let costIsEstimate = run.costIsEstimate;
  let providerMode: string = run.providerMode ?? 'none';

  const piece = run.piece;
  const content = (piece.content ?? {}) as PieceContent;
  const articleUrl = run.publication?.url ?? null;
  const ownHosts = await resolveOwnSiteHosts(run.workspaceId);

  try {
    await prisma.growthConversationRun.update({
      where: { id: runId },
      data: {
        startedAt: run.startedAt ?? new Date(),
        status: 'generating_queries',
        progressMessage: 'Generando queries',
      },
    });

    if (await isCancelled(runId)) {
      return (await prisma.growthConversationRun.findUniqueOrThrow({ where: { id: runId } }));
    }

    const queriesResult = await generateSearchQueries({
      title: piece.title,
      keyword: piece.keyword,
      excerpt: content.excerpt ?? null,
      htmlSnippet: content.html?.slice(0, 4000) ?? content.markdown?.slice(0, 4000) ?? null,
      languageCode: config.languageCode,
      maxQueries: config.maxQueries,
      businessContext: null,
    });

    const uniqueQueries = new Map<string, { query: string; rationale: string }>();
    for (const q of queriesResult.queries) {
      const key = normalizeQueryKey(q.query);
      if (!uniqueQueries.has(key)) uniqueQueries.set(key, q);
    }

    const queryRows = [];
    for (const q of uniqueQueries.values()) {
      const row = await prisma.growthSearchQuery.upsert({
        where: {
          runId_queryNormalized: {
            runId,
            queryNormalized: normalizeQueryKey(q.query),
          },
        },
        create: {
          workspaceId: run.workspaceId,
          runId,
          pieceId: piece.id,
          query: q.query,
          queryNormalized: normalizeQueryKey(q.query),
          rationale: q.rationale,
          languageCode: config.languageCode,
          locationCode: config.locationCode,
        },
        update: { rationale: q.rationale },
      });
      queryRows.push(row);
    }

    await setProgress(runId, 'searching', 'Buscando SERP', {
      queryCount: queryRows.length,
    });

    const dfs = resolveDataForSeoConfig();
    providerMode = dfs?.mode ?? 'none';
    await prisma.growthConversationRun.update({
      where: { id: runId },
      data: { providerMode },
    });

    const serpCandidates: Array<{
      queryId: string;
      url: string;
      title: string | null;
      snippet: string | null;
      position: number | null;
      resultType: GrowthSerpResultType;
      domain: string | null;
      raw: unknown;
      providerMode: string;
    }> = [];

    if (!dfs) {
      partial = true;
      discardMotives.push('DataForSEO no configurado — sin SERP');
    } else {
      for (const qRow of queryRows) {
        if (await isCancelled(runId)) break;

        if (
          wouldExceedSpendLimit(spentUsd, config.estimatedCostPerSerpUsd, config.maxSpendUsd)
        ) {
          partial = true;
          discardMotives.push('límite de spend alcanzado antes de SERP');
          break;
        }

        try {
          const serp = await fetchGoogleOrganicSerp(dfs, {
            keyword: qRow.query,
            locationCode: config.locationCode,
            languageCode: config.languageCode,
            depth: config.maxSerpResultsPerQuery,
          });
          spentUsd += serp.cost;
          estimatedUsd += config.estimatedCostPerSerpUsd;
          // Solo tratamos costUsd como real si el proveedor devolvió cost > 0 (live)
          if (serp.cost > 0) costIsEstimate = false;
          else costIsEstimate = true;
          providerMode = serp.mode;

          let taken = 0;
          for (const item of serp.items) {
            if (taken >= config.maxSerpResultsPerQuery) break;
            if (!isLikelyConversationUrl(item.url, item.resultType)) continue;
            if (isOwnSite(item.url, ownHosts)) {
              discardMotives.push(`own site: ${extractDomain(item.url)}`);
              continue;
            }
            serpCandidates.push({
              queryId: qRow.id,
              url: item.url,
              title: item.title,
              snippet: item.description,
              position: item.position,
              resultType: mapResultType(item.resultType),
              domain: item.domain ?? extractDomain(item.url),
              raw: item.raw,
              providerMode: serp.mode,
            });
            taken += 1;
          }
        } catch (err) {
          partial = true;
          discardMotives.push(
            `SERP error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        await prisma.growthConversationRun.update({
          where: { id: runId },
          data: {
            costUsd: spentUsd,
            costEstimatedUsd: estimatedUsd,
            costIsEstimate,
            providerMode,
            serpHitCount: serpCandidates.length,
          },
        });
      }
    }

    // Deduplicar por urlNormalized a nivel run
    const byUrl = new Map<string, (typeof serpCandidates)[number]>();
    for (const c of serpCandidates) {
      const key = normalizeUrl(c.url);
      if (!key || byUrl.has(key)) continue;
      byUrl.set(key, c);
    }

    const hitRows = [];
    for (const [urlNormalized, c] of byUrl) {
      const hit = await prisma.growthSerpHit.upsert({
        where: { runId_urlNormalized: { runId, urlNormalized } },
        create: {
          workspaceId: run.workspaceId,
          runId,
          queryId: c.queryId,
          url: c.url,
          urlNormalized,
          title: c.title,
          snippet: c.snippet,
          position: c.position,
          resultType: c.resultType,
          domain: c.domain,
          providerPayload: c.raw as Prisma.InputJsonValue,
          providerMode: c.providerMode,
        },
        update: {
          title: c.title,
          snippet: c.snippet,
        },
      });
      hitRows.push(hit);
    }

    await setProgress(runId, 'verifying', 'Verificando páginas', {
      serpHitCount: hitRows.length,
    });

    if (await isCancelled(runId)) {
      return prisma.growthConversationRun.findUniqueOrThrow({ where: { id: runId } });
    }

    const toVerify = hitRows.slice(0, config.maxPagesToVerify);
    const reuseCutoff = new Date(Date.now() - REUSE_PAGE_MS);

    type ScoredCandidate = {
      hitId: string;
      conversationId: string;
      opportunityScore: number;
      evidenceConfidence: number;
      scoreBreakdown: Prisma.InputJsonValue;
      suitable: boolean;
    };

    const scored: ScoredCandidate[] = [];

    await mapPool(toVerify, config.concurrency, async (hit) => {
      if (await isCancelled(runId)) return;

      let page = await prisma.growthConversationPage.findUnique({
        where: {
          workspaceId_urlNormalized: {
            workspaceId: run.workspaceId,
            urlNormalized: hit.urlNormalized,
          },
        },
      });

      const reusable =
        page &&
        page.verifyStatus === 'verified' &&
        page.verifiedAt &&
        page.verifiedAt >= reuseCutoff;

      if (!reusable) {
        try {
          const verified = await verifyConversationPage({
            url: hit.url,
            articleContext: { title: piece.title, keyword: piece.keyword },
            timeoutMs: config.pageTimeoutMs,
            maxBytes: config.maxPageBytes,
          });

          page = await prisma.growthConversationPage.upsert({
            where: {
              workspaceId_urlNormalized: {
                workspaceId: run.workspaceId,
                urlNormalized: verified.urlNormalized,
              },
            },
            create: {
              workspaceId: run.workspaceId,
              url: verified.url,
              urlNormalized: verified.urlNormalized,
              domain: verified.domain,
              title: verified.title,
              topic: verified.topic,
              questionText: verified.questionText,
              audienceFitNotes: verified.audienceFitNotes,
              threadCreatedAt: verified.threadCreatedAt,
              lastActivityAt: verified.lastActivityAt,
              threadCreatedAtKnown: verified.threadCreatedAtKnown,
              lastActivityAtKnown: verified.lastActivityAtKnown,
              participationSignals: verified.participationSignals,
              allowsReplies: verified.allowsReplies,
              isClosed: verified.isClosed,
              isArchived: verified.isArchived,
              linkRulesNotes: verified.linkRulesNotes,
              evidenceSnippet: verified.evidenceSnippet,
              verifyStatus: verified.verifyStatus,
              verifiedAt: verified.verifiedAt,
              verifyError: verified.verifyError,
            },
            update: {
              url: verified.url,
              title: verified.title,
              topic: verified.topic,
              questionText: verified.questionText,
              audienceFitNotes: verified.audienceFitNotes,
              threadCreatedAt: verified.threadCreatedAt,
              lastActivityAt: verified.lastActivityAt,
              threadCreatedAtKnown: verified.threadCreatedAtKnown,
              lastActivityAtKnown: verified.lastActivityAtKnown,
              participationSignals: verified.participationSignals,
              allowsReplies: verified.allowsReplies,
              isClosed: verified.isClosed,
              isArchived: verified.isArchived,
              linkRulesNotes: verified.linkRulesNotes,
              evidenceSnippet: verified.evidenceSnippet,
              verifyStatus: verified.verifyStatus,
              verifiedAt: verified.verifiedAt,
              verifyError: verified.verifyError,
            },
          });
        } catch (err) {
          partial = true;
          discardMotives.push(
            `verify error ${hit.urlNormalized}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return;
        }
      }

      if (!page) return;

      if (page.verifyStatus !== 'verified') {
        discardMotives.push(`${page.urlNormalized}: ${page.verifyStatus}`);
        return;
      }

      const scoredOpp = scoreOpportunity({
        verify: page,
        articleKeyword: piece.keyword,
        articleTitle: piece.title,
        audienceHints: piece.keyword ? [piece.keyword] : [],
        weights: config.scoreWeights,
      });

      const suitable =
        scoredOpp.opportunityScore >= config.minOpportunityScore &&
        page.isClosed !== true &&
        page.isArchived !== true;

      if (!suitable) {
        discardMotives.push(
          `score bajo ${page.urlNormalized}: ${scoredOpp.opportunityScore.toFixed(2)}`,
        );
      }

      scored.push({
        hitId: hit.id,
        conversationId: page.id,
        opportunityScore: scoredOpp.opportunityScore,
        evidenceConfidence: scoredOpp.evidenceConfidence,
        scoreBreakdown: scoredOpp.breakdown as unknown as Prisma.InputJsonValue,
        suitable,
      });
    });

    const verifiedCount = scored.length;
    await setProgress(runId, 'scoring', 'Rankeando oportunidades', {
      verifiedCount,
    });

    const suitableSorted = scored
      .filter((s) => s.suitable)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    const recommended = suitableSorted.slice(0, config.maxRecommended);
    // 0 recomendaciones es válido

    for (const [rank, item] of recommended.entries()) {
      await prisma.growthOpportunity.upsert({
        where: {
          runId_conversationId: {
            runId,
            conversationId: item.conversationId,
          },
        },
        create: {
          workspaceId: run.workspaceId,
          runId,
          pieceId: piece.id,
          conversationId: item.conversationId,
          serpHitId: item.hitId,
          opportunityScore: item.opportunityScore,
          evidenceConfidence: item.evidenceConfidence,
          scoreBreakdown: item.scoreBreakdown,
          editorialStatus: 'candidate',
          recommendedRank: rank + 1,
        },
        update: {
          opportunityScore: item.opportunityScore,
          evidenceConfidence: item.evidenceConfidence,
          scoreBreakdown: item.scoreBreakdown,
          recommendedRank: rank + 1,
          serpHitId: item.hitId,
        },
      });
    }

    // También persistir no-recomendadas como candidate sin rank (opcional: solo recommended)
    // Spec: "Create opportunities only for verified suitable pages; top maxRecommended"
    // → solo recommended.

    await setProgress(runId, 'drafting', 'Generando borradores', {
      opportunityCount: recommended.length,
    });

    if (await isCancelled(runId)) {
      return prisma.growthConversationRun.findUniqueOrThrow({ where: { id: runId } });
    }

    const opps = await prisma.growthOpportunity.findMany({
      where: { runId, recommendedRank: { not: null } },
      include: { conversation: true },
      orderBy: { recommendedRank: 'asc' },
    });

    for (const opp of opps) {
      try {
        const allowLink = !/no\s+links?|sin\s+enlaces/i.test(
          opp.conversation.linkRulesNotes ?? '',
        );
        const draft = await generateReplyDraft({
          question: opp.conversation.questionText ?? opp.conversation.title ?? '',
          evidence: opp.conversation.evidenceSnippet ?? '',
          articleTitle: piece.title,
          articleUrl: articleUrl ?? '',
          keyword: piece.keyword,
          allowLink: allowLink && Boolean(articleUrl),
          linkRulesNotes: opp.conversation.linkRulesNotes,
        });

        await prisma.growthReplyDraft.create({
          data: {
            workspaceId: run.workspaceId,
            opportunityId: opp.id,
            version: 1,
            body: draft.body,
            includeLink: draft.includeLink,
            linkUrl: draft.linkUrl,
            sources: draft.sources as unknown as Prisma.InputJsonValue,
            status: 'pending_review',
          },
        });

        await prisma.growthOpportunity.update({
          where: { id: opp.id },
          data: { editorialStatus: 'draft_ready' },
        });
      } catch (err) {
        partial = true;
        discardMotives.push(
          `draft error ${opp.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const uniqueMotives = [...new Set(discardMotives)].slice(0, 40);
    await prisma.growthTopicInsight.create({
      data: {
        workspaceId: run.workspaceId,
        pieceId: piece.id,
        runId,
        topicKey: normalizeQueryKey(piece.keyword || piece.title).slice(0, 120) || runId,
        status: 'draft_for_discovery',
        summary: {
          queryCount: queryRows.length,
          serpHitCount: hitRows.length,
          verifiedCount,
          recommendedCount: recommended.length,
          approvedCountPlaceholder: 0,
          publishedCountPlaceholder: 0,
          costUsd: spentUsd,
          costEstimatedUsd: estimatedUsd,
          costIsEstimate,
          discardMotives: uniqueMotives,
          note: 'Insight para Discovery — NO cambia prioridades automáticamente',
        } as Prisma.InputJsonValue,
      },
    });

    const finalStatus = partial ? 'completed_partial' : 'completed';
    return prisma.growthConversationRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        progressMessage: partial ? 'Completado parcial' : 'Completado',
        completedAt: new Date(),
        costUsd: spentUsd,
        costEstimatedUsd: estimatedUsd,
        costIsEstimate,
        providerMode,
        queryCount: queryRows.length,
        serpHitCount: hitRows.length,
        verifiedCount,
        opportunityCount: recommended.length,
        errorMessage: null,
      },
    });
  } catch (err) {
    hardFail = err instanceof Error ? err.message : String(err);
    partial = true;
    return prisma.growthConversationRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        progressMessage: 'Falló',
        errorMessage: hardFail.slice(0, 4000),
        completedAt: new Date(),
        costUsd: spentUsd,
        costEstimatedUsd: estimatedUsd,
        costIsEstimate,
        providerMode,
      },
    });
  }
}
