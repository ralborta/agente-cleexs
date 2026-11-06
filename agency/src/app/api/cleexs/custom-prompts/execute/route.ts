import { NextResponse } from 'next/server';
import {
  cleexsLiveSlotCount,
  executeWeeklyPrompt,
  tryPrompt,
  upsertWeeklyPrompt,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Body = {
  savedPromptId?: string;
  slot?: number;
  promptText?: string;
};

/**
 * Mide un prompt con IA real en Cleexs.
 * - Con savedPromptId → execute del prompt guardado
 * - Sin id / slot fuera del live maxSlots → prompt-try (misma IA, sin cupo durable)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    let savedPromptId = body.savedPromptId?.trim() || '';
    const text = body.promptText?.trim() || '';
    const slot = typeof body.slot === 'number' ? body.slot : 0;
    const liveMax = await cleexsLiveSlotCount();

    if (!savedPromptId && text && slot >= 0 && slot < liveMax) {
      try {
        const saved = await upsertWeeklyPrompt(slot, text);
        savedPromptId = saved.id;
      } catch {
        /* cae a prompt-try */
      }
    }

    if (savedPromptId) {
      try {
        const result = await executeWeeklyPrompt(savedPromptId);
        return NextResponse.json({
          ok: true,
          mode: 'saved',
          savedPromptId,
          executionId: result.executionId,
          createdAt: result.createdAt,
          responseText: result.responseText,
          analysis: result.analysis,
          totalTokens: result.totalTokens,
          savedPrompt: result.savedPrompt,
        });
      } catch {
        /* fallback try */
      }
    }

    if (!text) {
      return NextResponse.json({ error: 'Falta savedPromptId o promptText' }, { status: 400 });
    }

    const tried = await tryPrompt(text);
    return NextResponse.json({
      ok: true,
      mode: 'try',
      savedPromptId: savedPromptId || null,
      responseText: tried.responseText,
      analysis: tried.analysis,
      totalTokens: tried.totalTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo medir el prompt en Cleexs', detail: (e as Error).message },
      { status: 503 },
    );
  }
}
