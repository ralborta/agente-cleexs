import type { StrategistPlan } from './types';

/** Parsea hints embebidos en objective (sin migración de DB). */
export function parseMissionPlanHints(mission: {
  title?: string | null;
  objective?: string | null;
}): Partial<StrategistPlan> {
  const obj = mission.objective ?? '';
  const title = mission.title ?? '';
  const wantsPro =
    /\[depth:pro\]/i.test(obj) ||
    /\bdepth:pro\b/i.test(obj) ||
    title.toLowerCase().includes('pro') ||
    obj.toLowerCase().includes(' profundo');

  const topicMatch = obj.match(/\[topic:([^\]]+)\]/i);
  const pieceMatch = obj.match(/\[pieceType:([a-z_]+)\]/i);

  return {
    ...(topicMatch?.[1]?.trim() ? { topic: topicMatch[1].trim() } : {}),
    ...(pieceMatch?.[1]?.trim() ? { pieceType: pieceMatch[1].trim() } : {}),
    ...(wantsPro ? { depth: 'pro' as const, pieceType: pieceMatch?.[1]?.trim() || 'pillar' } : {}),
  };
}

export function buildMissionObjective(
  objective: string | undefined,
  opts: { topic?: string; pieceType?: string; depth?: string },
): string | undefined {
  const parts = [objective?.trim()].filter(Boolean) as string[];
  if (opts.depth === 'pro') parts.push('[depth:pro]');
  if (opts.topic?.trim()) parts.push(`[topic:${opts.topic.trim()}]`);
  if (opts.pieceType?.trim()) parts.push(`[pieceType:${opts.pieceType.trim()}]`);
  const joined = parts.join(' ').trim();
  return joined || undefined;
}
