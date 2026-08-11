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

/**
 * Repara mojibake UTF-8 típico (`técnicas` → `tÃ©cnicas`) cuando el texto
 * UTF-8 se interpretó como Latin-1/Windows-1252.
 */
export function fixUtf8Mojibake(input: string): string {
  if (!input || !/[ÃÂ]/.test(input)) return input;
  let current = input;
  for (let i = 0; i < 2; i += 1) {
    if (![...current].every((ch) => ch.charCodeAt(0) <= 255)) break;
    if (!/[ÃÂ]/.test(current)) break;
    try {
      const bytes = Uint8Array.from([...current].map((ch) => ch.charCodeAt(0)));
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!decoded || decoded === current || decoded.includes('\uFFFD')) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

export function fixUtf8MojibakeDeep<T>(value: T): T {
  if (typeof value === 'string') return fixUtf8Mojibake(value) as T;
  if (Array.isArray(value)) return value.map((item) => fixUtf8MojibakeDeep(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = fixUtf8MojibakeDeep(nested);
    }
    return out as T;
  }
  return value;
}

export const PIECE_TYPES: ContentPieceType[] = [
  'faq',
  'comparison',
  'checklist',
  'how_to',
  'pillar',
  'case_study',
  'landing',
  'definition',
  'glossary',
];

export function pickPieceType(index: number): ContentPieceType {
  return PIECE_TYPES[index % PIECE_TYPES.length];
}
