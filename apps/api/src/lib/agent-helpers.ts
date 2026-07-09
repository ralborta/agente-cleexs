import type { ContentPieceType, MissionStepRole } from '@prisma/client';
import { prisma } from './prisma';

export async function logAgentActivity(params: {
  workspaceId: string;
  agentId: string;
  missionId?: string;
  role?: MissionStepRole;
  message: string;
  level?: 'info' | 'success' | 'warning' | 'error';
}) {
  return prisma.agentActivity.create({
    data: {
      workspaceId: params.workspaceId,
      agentId: params.agentId,
      missionId: params.missionId,
      role: params.role,
      message: params.message,
      level: params.level ?? 'info',
    },
  });
}

export async function createMissionStep(params: {
  missionId: string;
  role: MissionStepRole;
  message?: string;
  input?: unknown;
  output?: unknown;
}) {
  return prisma.missionStep.create({
    data: {
      missionId: params.missionId,
      role: params.role,
      status: 'in_progress',
      message: params.message,
      input: params.input as never,
      startedAt: new Date(),
    },
  });
}

export async function completeMissionStep(
  stepId: string,
  output?: unknown,
  message?: string,
) {
  return prisma.missionStep.update({
    where: { id: stepId },
    data: {
      status: 'completed',
      output: output as never,
      message,
      endedAt: new Date(),
    },
  });
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const PIECE_TYPES: ContentPieceType[] = [
  'faq',
  'comparison',
  'checklist',
  'how_to',
  'pillar',
  'definition',
  'glossary',
];

export function pickPieceType(index: number): ContentPieceType {
  return PIECE_TYPES[index % PIECE_TYPES.length];
}
