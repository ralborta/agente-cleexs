import { NextResponse } from 'next/server';
import {
  deleteWeeklyPrompt,
  listWeeklyPrompts,
  selectWeeklyPrompt,
  upsertWeeklyPrompt,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Agency: máx. 40 prompts propios → slots Cleexs 0..39 */
const AGENCY_SLOTS = 40;

function mapSlot(s: {
  slot: number;
  id: string | null;
  title: string;
  promptText: string;
  updatedAt: string | null;
  lastExecutedAt: string | null;
  resultsCount: number;
}) {
  return {
    slot: s.slot,
    id: s.id,
    title: s.title,
    promptText: s.promptText,
    updatedAt: s.updatedAt,
    lastExecutedAt: s.lastExecutedAt,
    resultsCount: s.resultsCount,
  };
}

export async function GET() {
  try {
    const data = await listWeeklyPrompts();
    const slots = data.slots
      .filter((s) => s.slot < AGENCY_SLOTS && s.promptText.trim())
      .map(mapSlot);
    return NextResponse.json({
      brandId: data.brandId,
      runSchedule: data.runSchedule,
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
      max: AGENCY_SLOTS,
      prompts: slots,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron leer prompts Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}

type PutBody = {
  /** Lista de prompts (máx 40). Solo toca slots presentes o previamente ocupados. */
  prompts: Array<{ slot?: number; promptText: string; select?: boolean }>;
};

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body.prompts) ? body.prompts.slice(0, AGENCY_SLOTS) : [];

    const bySlot = new Map<number, { promptText: string; select?: boolean }>();
    items.forEach((p, i) => {
      const slot = typeof p.slot === 'number' ? p.slot : i;
      if (slot < 0 || slot >= AGENCY_SLOTS) return;
      bySlot.set(slot, { promptText: p.promptText || '', select: p.select });
    });

    const current = await listWeeklyPrompts();
    const occupied = new Set(
      current.slots.filter((s) => s.slot < AGENCY_SLOTS && s.promptText.trim()).map((s) => s.slot),
    );
    const touch = new Set([...bySlot.keys(), ...occupied]);

    const saved: Array<{ slot: number; id: string; title: string; promptText: string }> = [];

    for (const slot of [...touch].sort((a, b) => a - b)) {
      const item = bySlot.get(slot);
      const text = item?.promptText?.trim() || '';
      if (!text) {
        await deleteWeeklyPrompt(slot);
        continue;
      }
      const row = await upsertWeeklyPrompt(slot, text);
      saved.push(row);
    }

    const selectWant = items.find((p) => p.select && p.promptText?.trim())?.promptText?.trim();
    const selectId = selectWant
      ? saved.find((s) => s.promptText === selectWant)?.id
      : saved[0]?.id ?? null;

    if (selectId) {
      try {
        await selectWeeklyPrompt(selectId);
      } catch {
        /* selección opcional */
      }
    }

    const data = await listWeeklyPrompts();
    return NextResponse.json({
      ok: true,
      prompts: data.slots.filter((s) => s.slot < AGENCY_SLOTS && s.promptText.trim()).map(mapSlot),
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron guardar prompts en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
