import { NextResponse } from 'next/server';
import {
  executeWeeklyPrompt,
  listWeeklyPrompts,
  triggerCleexsRun,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

type Body = {
  /** Si true, mide cada prompt propio activo (slots 0..2) vía portal execute */
  customOnly?: boolean;
  /** Si se pasa, mide solo ese savedPromptId */
  savedPromptId?: string;
};

/**
 * Dispara medición real en Cleexs.
 * Por defecto: ejecuta todos los prompts propios guardados (máx 3).
 * Si no hay propios, dispara una corrida monthly estándar.
 */
export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Body;

    if (body.savedPromptId) {
      const one = await executeWeeklyPrompt(body.savedPromptId);
      return NextResponse.json({
        ok: true,
        mode: 'single',
        results: [
          {
            savedPromptId: body.savedPromptId,
            executionId: one.executionId,
            responseText: one.responseText,
            analysis: one.analysis,
          },
        ],
      });
    }

    const weekly = await listWeeklyPrompts();
    const own = weekly.slots.filter((s) => s.slot < 3 && s.id && s.promptText.trim());

    if (own.length > 0 || body.customOnly) {
      if (!own.length) {
        return NextResponse.json(
          { error: 'No hay prompts propios guardados para medir. Agregá hasta 3 en Prompts.' },
          { status: 400 },
        );
      }
      const results = [];
      for (const slot of own) {
        const r = await executeWeeklyPrompt(slot.id!);
        results.push({
          slot: slot.slot,
          savedPromptId: slot.id,
          title: slot.title,
          executionId: r.executionId,
          responseText: r.responseText,
          analysis: r.analysis,
        });
      }
      return NextResponse.json({ ok: true, mode: 'custom', count: results.length, results });
    }

    const selected = weekly.selectedWeeklyPortalPromptId;
    if (selected) {
      const run = await triggerCleexsRun({
        runType: 'weekly_portal',
        weeklyPortalSavedPromptId: selected,
      });
      return NextResponse.json({ ok: true, mode: 'weekly_portal', ...run });
    }

    const run = await triggerCleexsRun({ runType: 'monthly' });
    return NextResponse.json({ ok: true, mode: 'monthly', ...run });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo disparar la corrida Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
