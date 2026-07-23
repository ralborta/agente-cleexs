/** Convierte frecuencia humana (ej. "2/semana") a días mínimos entre misiones. */
export function frequencyToIntervalDays(frequency: string | null | undefined): number {
  if (!frequency?.trim()) return 3;

  const normalized = frequency.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*\/\s*(semana|sem|dia|día|mes)$/);
  if (!match) return 3;

  const count = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(count) || count <= 0) return 3;

  if (unit.startsWith('sem')) return Math.max(1, Math.ceil(7 / count));
  if (unit.startsWith('d') || unit.startsWith('dí')) return Math.max(1, Math.ceil(1 / count));
  if (unit.startsWith('mes')) return Math.max(1, Math.ceil(30 / count));

  return 3;
}

export const FREQUENCY_PRESETS = [
  { value: '1/semana', label: '1 pieza por semana' },
  { value: '2/semana', label: '2 piezas por semana' },
  { value: '3/semana', label: '3 piezas por semana' },
  { value: '1/día', label: '1 pieza por día' },
] as const;
