import { NextResponse } from 'next/server';
import {
  cleexsLiveSlotCount,
  deleteWeeklyPrompt,
  listWeeklyPrompts,
  selectWeeklyPrompt,
  upsertWeeklyPrompt,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Tope Agency (EasyPanel): 40 prompts propios. */
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
    const liveMax = await cleexsLiveSlotCount();
    const data = await listWeeklyPrompts();
    const slots = data.slots
      .filter((s) => s.slot < Math.min(AGENCY_SLOTS, liveMax) && s.promptText.trim())
      .map(mapSlot);
    return NextResponse.json({
      brandId: data.brandId,
      runSchedule: data.runSchedule,
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
      max: AGENCY_SLOTS,
      cleexsLiveSlots: liveMax,
      prompts: slots,
      note:
        liveMax < AGENCY_SLOTS
          ? `Cleexs sincroniza ${liveMax} slots; Agency permite ${AGENCY_SLOTS} (el resto se guarda en el proyecto y se mide con IA igual).`
          : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron leer prompts Cleexs', detail: (e as Error).message },
      { status: 503 },
    );
  }
}

type PutBody = {
  prompts: Array<{ slot?: number; promptText: string; select?: boolean }>;
};

/**
 * Guarda en Cleexs solo los slots que la API live acepta.
 * El resto (hasta 40) vive en el proyecto Agency (localStorage) y se mide vía prompt-try.
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body.prompts) ? body.prompts.slice(0, AGENCY_SLOTS) : [];
    const liveMax = await cleexsLiveSlotCount();

    const bySlot = new Map<number, { promptText: string; select?: boolean }>();
    items.forEach((p, i) => {
      const slot = typeof p.slot === 'number' ? p.slot : i;
      if (slot < 0 || slot >= AGENCY_SLOTS) return;
      bySlot.set(slot, { promptText: p.promptText || '', select: p.select });
    });

    const current = await listWeeklyPrompts();
    const occupied = new Set(
      current.slots.filter((s) => s.slot < liveMax && s.promptText.trim()).map((s) => s.slot),
    );
    const touch = new Set(
      [...bySlot.keys()].filter((s) => s < liveMax).concat([...occupied]),
    );

    const saved: Array<{ slot: number; id: string; title: string; promptText: string }> = [];
    const warnings: string[] = [];

    for (const slot of [...touch].sort((a, b) => a - b)) {
      const item = bySlot.get(slot);
      const text = item?.promptText?.trim() || '';
      try {
        if (!text) {
          await deleteWeeklyPrompt(slot);
          continue;
        }
        const row = await upsertWeeklyPrompt(slot, text);
        saved.push(row);
      } catch (e) {
        warnings.push(`slot ${slot}: ${(e as Error).message}`);
      }
    }

    const beyond = [...bySlot.entries()].filter(([slot, v]) => slot >= liveMax && v.promptText.trim());
    if (beyond.length) {
      warnings.push(
        `${beyond.length} prompt(s) en slots ≥ ${liveMax} quedan en Agency (se miden con IA; sync Cleexs pendiente de ampliar slots).`,
      );
    }

    const selectWant = items.find((p) => p.select && p.promptText?.trim())?.promptText?.trim();
    const selectId = selectWant
      ? saved.find((s) => s.promptText === selectWant)?.id
      : saved[0]?.id ?? null;

    if (selectId) {
      try {
        await selectWeeklyPrompt(selectId);
      } catch {
        /* opcional */
      }
    }

    const data = await listWeeklyPrompts();
    return NextResponse.json({
      ok: true,
      max: AGENCY_SLOTS,
      cleexsLiveSlots: liveMax,
      prompts: data.slots.filter((s) => s.slot < liveMax && s.promptText.trim()).map(mapSlot),
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
      warnings,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron guardar prompts en Cleexs', detail: (e as Error).message },
      { status: 503 },
    );
  }
}
