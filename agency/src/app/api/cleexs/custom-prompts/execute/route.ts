import { NextResponse } from 'next/server';
import { executeWeeklyPrompt, upsertWeeklyPrompt } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Body = {
  savedPromptId?: string;
  /** Si no hay id, se puede pasar slot + promptText para guardar y medir */
  slot?: number;
  promptText?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    let savedPromptId = body.savedPromptId?.trim() || '';

    if (!savedPromptId) {
      const slot = typeof body.slot === 'number' ? body.slot : 0;
      const text = body.promptText?.trim() || '';
      if (!text) {
        return NextResponse.json({ error: 'Falta savedPromptId o promptText' }, { status: 400 });
      }
      if (slot < 0 || slot > 2) {
        return NextResponse.json({ error: 'slot debe ser 0, 1 o 2' }, { status: 400 });
      }
      const saved = await upsertWeeklyPrompt(slot, text);
      savedPromptId = saved.id;
    }

    const result = await executeWeeklyPrompt(savedPromptId);
    return NextResponse.json({
      ok: true,
      savedPromptId,
      executionId: result.executionId,
      createdAt: result.createdAt,
      responseText: result.responseText,
      analysis: result.analysis,
      totalTokens: result.totalTokens,
      savedPrompt: result.savedPrompt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo medir el prompt en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
