import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await buildSnapshot();
    return NextResponse.json(snap);
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo obtener datos de Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
