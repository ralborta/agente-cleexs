import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await buildSnapshot();
    return NextResponse.json({
      runId: s.latestRun?.id ?? null,
      prompts: s.prompts,
      weakPrompts: s.weakPrompts,
    });
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo obtener datos de Cleexs', detail: (e as Error).message }, { status: 502 });
  }
}
