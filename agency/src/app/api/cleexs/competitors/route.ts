import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await buildSnapshot();
    return NextResponse.json({
      brand: { name: s.brand.name, domain: s.brand.domain },
      visibilityPct: s.visibilityPct,
      competitors: s.brand.competitors,
      competitorMentions: s.competitorMentions,
      history: s.history.map((r) => ({
        runId: r.id,
        createdAt: r.createdAt,
        visibilityPct: r.visibilityPct,
        appearances: r.appearances,
        promptsAnalyzed: r.promptsAnalyzed,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo obtener datos de Cleexs', detail: (e as Error).message }, { status: 502 });
  }
}
