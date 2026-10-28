import { NextResponse } from 'next/server';
import {
  deleteWeeklyPrompt,
  listWeeklyPrompts,
  selectWeeklyPrompt,
  upsertWeeklyPrompt,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

/** Agency: máx. 3 prompts propios → slots Cleexs 0, 1, 2 */
const AGENCY_SLOTS = 3;

export async function GET() {
  try {
    const data = await listWeeklyPrompts();
    const slots = data.slots
      .filter((s) => s.slot < AGENCY_SLOTS && s.promptText.trim())
      .map((s) => ({
        slot: s.slot,
        id: s.id,
        title: s.title,
        promptText: s.promptText,
        updatedAt: s.updatedAt,
        lastExecutedAt: s.lastExecutedAt,
        resultsCount: s.resultsCount,
      }));
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
  /** Reemplaza los slots 0..2 con esta lista (máx 3). Ítems vacíos se borran. */
  prompts: Array<{ slot?: number; promptText: string; select?: boolean }>;
};

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body.prompts) ? body.prompts.slice(0, AGENCY_SLOTS) : [];
    const saved: Array<{ slot: number; id: string; title: string; promptText: string }> = [];

    for (let slot = 0; slot < AGENCY_SLOTS; slot++) {
      const item = items.find((p, i) => (typeof p.slot === 'number' ? p.slot === slot : i === slot));
      const text = item?.promptText?.trim() || '';
      if (!text) {
        await deleteWeeklyPrompt(slot);
        continue;
      }
      const row = await upsertWeeklyPrompt(slot, text);
      saved.push(row);
    }

    const selectId = items.find((p) => p.select && p.promptText?.trim())
      ? saved.find((s) => {
          const want = items.find((p) => p.select)?.promptText?.trim();
          return want && s.promptText === want;
        })?.id
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
      prompts: data.slots
        .filter((s) => s.slot < AGENCY_SLOTS && s.promptText.trim())
        .map((s) => ({
          slot: s.slot,
          id: s.id,
          title: s.title,
          promptText: s.promptText,
          updatedAt: s.updatedAt,
          lastExecutedAt: s.lastExecutedAt,
          resultsCount: s.resultsCount,
        })),
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron guardar prompts en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
