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

const runningMissions = new Set<string>();

export async function executeMission(missionId: string) {
  if (runningMissions.has(missionId)) {
    return { skipped: true, reason: 'already_running' };
  }

  runningMissions.add(missionId);

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

    await prisma.mission.update({
      where: { id: missionId },
      data: { status: 'in_progress', startedAt: new Date() },
    });

    const missionCount = await prisma.mission.count({
      where: { workspaceId: mission.workspaceId },
    });

    // --- Estratega ---
    const plan = runStrategist(teoConfig, missionCount);
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
    const research = runResearcher(plan);
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
    const draft = runWriter(plan, research, teoConfig.tone);
    const stepWriter = await createMissionStep({
      missionId,
      role: 'writer',
      message: 'Borrador generado',
      output: { excerpt: draft.excerpt },
    });
    await logAgentActivity({
      workspaceId: mission.workspaceId,
      agentId: mission.agentId,
      missionId,
      role: 'writer',
      message: `Borrador "${plan.title}" listo para revisión`,
    });
    await completeMissionStep(stepWriter.id, draft);

    // --- Albañil SEO ---
    const seo = runSeoBuilder(plan, draft);
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
        type: plan.pieceType as ContentPieceType,
        title: plan.title,
        slug: seo.slug,
        keyword: plan.keyword,
        status: teoConfig.autoPublish ? 'approved' : 'pending_approval',
        content: {
          markdown: draft.bodyMarkdown,
          html: draft.html,
          excerpt: draft.excerpt,
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
