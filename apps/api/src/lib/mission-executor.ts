import type { ContentPieceType } from '@prisma/client';
import { prisma } from './prisma';
import {
  completeMissionStep,
  createMissionStep,
  logAgentActivity,
} from './agent-helpers';
import {
  runResearcher,
  runSeoBuilder,
  runStrategist,
  runWriter,
} from './agents/teo/pipeline';
import { getStrategicPlanHints } from './agents/teo/strategist-metrics';
import { parseMissionPlanHints, parseRefreshPieceId } from './agents/teo/mission-plan';
import { resolveBrandKit } from './branding/brand-kit';
import { publishAndRecordPiece } from './integrations/wordpress-publish';
import {
  ensureDefaultCluster,
  enrichHtmlWithClusterInterlinks,
} from './content-cluster';
import {
  markOpportunityCovered,
  releaseOpportunity,
} from './agents/teo/keyword-opportunities';

const runningMissions = new Set<string>();

/** Título autogenerado al crear una misión manual sin nombre propio ("Misión manual — 31/7/2026"). */
const AUTO_MISSION_TITLE = /^Misión manual\s*[—-]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/;

/**
 * El título de la misión solo sirve como título del artículo si el usuario puso uno propio.
 * El autogenerado ("Misión manual — 31/7/2026") no debe terminar como título publicado:
 * en ese caso deja que el estratega lo construya desde tema + tipo de pieza.
 */
function resolvePieceTitle(input: {
  missionTitle: string | null;
  refreshTitle?: string;
  hintTitle?: string;
}): string | undefined {
  const missionTitle = input.missionTitle?.trim();

  if (missionTitle?.startsWith('Refresco:')) {
    return missionTitle.replace(/^Refresco:\s*/i, '').trim() || input.refreshTitle;
  }

  if (missionTitle?.startsWith('Misión manual') && !AUTO_MISSION_TITLE.test(missionTitle)) {
    return missionTitle;
  }

  return input.hintTitle ?? input.refreshTitle;
}

export async function executeMission(missionId: string) {
  if (runningMissions.has(missionId)) {
    return { skipped: true, reason: 'already_running' };
  }

  runningMissions.add(missionId);
  let opportunityId: string | undefined;
  let workspaceIdForOpportunity: string | undefined;

  try {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        agent: true,
        workspace: {
          include: {
            agentConfigs: {
              where: { agent: { slug: 'teo' } },
              include: { agent: true },
            },
          },
        },
      },
    });

    if (!mission) {
      throw new Error('Misión no encontrada');
    }
    workspaceIdForOpportunity = mission.workspaceId;

    if (mission.status === 'completed' || mission.status === 'cancelled') {
      return { skipped: true, reason: 'already_finished' };
    }

    const config = mission.workspace.agentConfigs[0];
    const teoConfig = {
      tone: config?.tone,
      topics: config?.topics as string[] | null,
      frequency: config?.frequency,
      autoPublish: config?.autoPublish ?? false,
    };
    const branding = resolveBrandKit(config?.branding, mission.workspace.name);

    await prisma.mission.update({
      where: { id: missionId },
      data: { status: 'in_progress', startedAt: new Date() },
    });

    const missionCount = await prisma.mission.count({
      where: { workspaceId: mission.workspaceId },
    });

    const planHints = parseMissionPlanHints(mission);
    const refreshPieceId = parseRefreshPieceId(mission.objective);
    const hasManualHints = Boolean(planHints.topic || planHints.pieceType);
    const isManualMission = Boolean(mission.title?.startsWith('Misión manual'));

    let refreshSource: {
      id: string;
      title: string;
      keyword: string | null;
      type: string;
    } | null = null;

    if (refreshPieceId) {
      refreshSource = await prisma.contentPiece.findUnique({
        where: { id: refreshPieceId },
        select: { id: true, title: true, keyword: true, type: true },
      });
      if (refreshSource) {
        await logAgentActivity({
          workspaceId: mission.workspaceId,
          agentId: mission.agentId,
          missionId,
          role: 'refresher',
          message: `Refrescador: actualizando "${refreshSource.title}"`,
        });
      }
    }

    // --- Estratega ---
    const metricsHints =
      refreshSource || hasManualHints || isManualMission
        ? {}
        : await getStrategicPlanHints(mission.workspace.slug, teoConfig, missionCount);

    opportunityId = metricsHints.opportunityId;

    if (metricsHints.rationale && !refreshSource) {
      await logAgentActivity({
        workspaceId: mission.workspaceId,
        agentId: mission.agentId,
        missionId,
        role: 'strategist',
        message: `Prioridad por métricas: ${metricsHints.rationale}`,
      });
    }

    const plan = runStrategist(teoConfig, missionCount, {
      ...metricsHints,
      ...planHints,
      title: resolvePieceTitle({
        missionTitle: mission.title,
        refreshTitle: refreshSource?.title,
        hintTitle: planHints.title ?? metricsHints.title,
      }),
      topic: planHints.topic ?? refreshSource?.keyword ?? refreshSource?.title ?? metricsHints.topic,
      pieceType:
        (planHints.pieceType as never) ??
        (refreshSource?.type as never) ??
        (metricsHints.pieceType as never),
      objective:
        mission.objective ??
        metricsHints.objective ??
        (refreshSource
          ? `Actualizar y mejorar "${refreshSource.title}" con datos recientes y mejor SEO/AEO.`
          : undefined),
    });
    const stepStrategist = await createMissionStep({
      missionId,
      role: 'strategist',
      message: `Planificada pieza: ${plan.title}`,
      output: plan,
    });
    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'strategist',
      message: `Estratega planificó "${plan.title}"`,
    });
    await completeMissionStep(stepStrategist.id, plan);

    // --- Researcher ---
    const research = await runResearcher(plan);
    const stepResearch = await createMissionStep({
      missionId,
      role: 'researcher',
      message: 'Outline y fuentes listos',
      output: research,
    });
    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'researcher',
      message: `Researcher completó outline para "${plan.title}"`,
    });
    await completeMissionStep(stepResearch.id, research);

    // --- Escritor ---
    const draft = await runWriter(plan, research, teoConfig.tone, branding);
    const stepWriter = await createMissionStep({
      missionId,
      role: 'writer',
      message: `Borrador generado (${draft.writerMode ?? 'template'})`,
      output: { excerpt: draft.excerpt, writerMode: draft.writerMode },
    });
    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'writer',
      message: `Borrador "${plan.title}" listo para revisión`,
    });
    await completeMissionStep(stepWriter.id, draft);

    const cluster = await ensureDefaultCluster(mission.workspace.slug);
    const { html: linkedHtml, links: interlinks } = await enrichHtmlWithClusterInterlinks(
      mission.workspaceId,
      cluster.id,
      draft.html,
      { excludePieceId: refreshSource?.id },
    );
    const draftLinked = { ...draft, html: linkedHtml };

    if (interlinks.length > 0) {
      await logAgentActivity({
        workspaceId: mission.workspaceId,
        agentId: mission.agentId,
        missionId,
        role: 'seo_builder',
        message: `Interlinks del ecosistema: ${interlinks.length} enlace(s) a piezas relacionadas`,
      });
    }

    // --- Albañil SEO ---
    const seo = runSeoBuilder(plan, draftLinked, branding);
    const stepSeo = await createMissionStep({
      missionId,
      role: 'seo_builder',
      message: 'Schema, OG y canonical aplicados',
      output: seo,
    });
    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'seo_builder',
      message: `SEO aplicado a "${plan.title}"`,
    });
    await completeMissionStep(stepSeo.id, seo);

    // --- Pieza + aprobación ---
    const piece = await prisma.contentPiece.create({
      data: {
        workspaceId: mission.workspaceId,
        missionId,
        clusterId: cluster.id,
        type: plan.pieceType as ContentPieceType,
        title: plan.title,
        slug: seo.slug,
        keyword: plan.keyword,
        status: teoConfig.autoPublish ? 'approved' : 'pending_approval',
        content: {
          markdown: draft.bodyMarkdown,
          html: linkedHtml,
          excerpt: draft.excerpt,
          // Se persiste la estructura para poder re-renderizar sin perder
          // tablas, gráficos, ejemplos y referencias al editar la pieza.
          articleData: draft.articleData,
          ...(refreshSource ? { refreshOfPieceId: refreshSource.id } : {}),
        },
        seoMeta: seo,
      },
    });

    if (!teoConfig.autoPublish) {
      await prisma.approval.create({
        data: {
          workspaceId: mission.workspaceId,
          pieceId: piece.id,
          status: 'pending',
        },
      });
      await logAgentActivity({
        workspaceId: mission.workspaceId,
        agentId: mission.agentId,
        missionId,
        role: 'publisher',
        level: 'warning',
        message: `"${plan.title}" en cola de aprobación`,
      });
    } else {
      try {
        const wpResult = await publishAndRecordPiece(
          mission.workspace.slug,
          mission.workspaceId,
          piece,
          { wpStatus: 'publish' },
        );
        await logAgentActivity({
          workspaceId: mission.workspaceId,
          agentId: mission.agentId,
          missionId,
          role: 'publisher',
          level: 'success',
          message: `"${plan.title}" autopublicada en WordPress (${wpResult.status}) — ${wpResult.url}`,
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Error desconocido';
        await logAgentActivity({
          workspaceId: mission.workspaceId,
          agentId: mission.agentId,
          missionId,
          role: 'publisher',
          level: 'error',
          message: `Autopublicación falló para "${plan.title}": ${detail}`,
        });
      }
    }

    if (opportunityId) {
      await markOpportunityCovered(mission.workspaceId, opportunityId).catch(() => undefined);
    }

    await prisma.mission.update({
      where: { id: missionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        objective: plan.objective,
      },
    });

    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'publisher',
      level: 'success',
      message: teoConfig.autoPublish
        ? `Misión completada: "${plan.title}"`
        : `Misión completada — "${plan.title}" esperando aprobación`,
    });

    return { missionId, pieceId: piece.id, status: 'completed' };
  } catch (err) {
    if (opportunityId && workspaceIdForOpportunity) {
      await releaseOpportunity(workspaceIdForOpportunity, opportunityId).catch(() => undefined);
    }
    throw err;
  } finally {
    runningMissions.delete(missionId);
  }
}

export function queueMissionExecution(missionId: string) {
  setImmediate(() => {
    executeMission(missionId).catch((err) => {
      console.error('[mission-executor] Error:', missionId, err);
      prisma.mission
        .update({
          where: { id: missionId },
          data: { status: 'failed' },
        })
        .catch(() => undefined);
    });
  });
}
