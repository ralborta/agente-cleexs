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
 * Persiste en Cleexs todos los slots que la API live acepta (hasta 40).
 * Brand/agencia: siempre CLEEXS_BRAND_ID + portal login (sin brandId del cliente).
 * Si prod aún reporta menos de 40, devolvemos warning duro: no hay backup en navegador.
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    // Ignorar cualquier brandId/projectId del body: aislamiento server-side por env.
    const items = Array.isArray(body.prompts) ? body.prompts.slice(0, AGENCY_SLOTS) : [];
    const liveMax = await cleexsLiveSlotCount();

    const bySlot = new Map<number, { promptText: string; select?: boolean }>();
    const rejectedSlots: number[] = [];
    items.forEach((p, i) => {
      const slot = typeof p.slot === 'number' ? p.slot : i;
      if (slot < 0 || slot >= AGENCY_SLOTS) {
        rejectedSlots.push(slot);
        return;
      }
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
    const failed: Array<{ slot: number; error: string }> = [];
    const warnings: string[] = [];
    if (rejectedSlots.length) {
      warnings.push(`Slots fuera de rango 0..${AGENCY_SLOTS - 1}: ${rejectedSlots.join(', ')}`);
    }

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
        const msg = (e as Error).message;
        warnings.push(`slot ${slot}: ${msg}`);
        failed.push({ slot, error: msg });
      }
    }

    const beyond = [...bySlot.entries()].filter(([slot, v]) => slot >= liveMax && v.promptText.trim());
    if (beyond.length) {
      for (const [slot] of beyond) {
        failed.push({
          slot,
          error: `Cleexs live maxSlots=${liveMax}; slot no durable`,
        });
      }
      warnings.push(
        `CRITICAL: Cleexs API solo acepta ${liveMax} slots (0..${liveMax - 1}); ${beyond.length} prompt(s) NO se guardaron en servidor. Upstream ralborta/cleexs weekly-prompts debe exponer maxSlots=${AGENCY_SLOTS} (p.ej. MAX_SLOT=${AGENCY_SLOTS - 1}) y migrar/redeploy — sin tocar ese repo desde Agency.`,
      );
    }
    if (liveMax < AGENCY_SLOTS) {
      warnings.push(
        `Cleexs live maxSlots=${liveMax} (esperado ${AGENCY_SLOTS}). Los prompts extra no son durables hasta actualizar la API.`,
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
    const ok = failed.length === 0 && beyond.length === 0;
    return NextResponse.json({
      ok,
      max: AGENCY_SLOTS,
      cleexsLiveSlots: liveMax,
      brandId: data.brandId,
      prompts: data.slots.filter((s) => s.slot < liveMax && s.promptText.trim()).map(mapSlot),
      selectedWeeklyPortalPromptId: data.selectedWeeklyPortalPromptId,
      savedCount: saved.length,
      failed,
      warnings,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudieron guardar prompts en Cleexs', detail: (e as Error).message },
      { status: 503 },
    );
  }
}
