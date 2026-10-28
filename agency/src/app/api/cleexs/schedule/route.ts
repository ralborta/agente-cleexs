import { NextResponse } from 'next/server';
import {
  cadenceToCleexs,
  getBrandRunSchedule,
  setBrandRunSchedule,
  type CleexsRunSchedule,
} from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getBrandRunSchedule();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo leer programación Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}

type PutBody = {
  /** Directo Cleexs */
  runSchedule?: CleexsRunSchedule;
  /** O desde UI Agency */
  enabled?: boolean;
  cadence?: string;
};

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    let next: CleexsRunSchedule;
    if ('runSchedule' in body) {
      next = body.runSchedule ?? null;
    } else {
      next = cadenceToCleexs(body.cadence || 'Semanal', body.enabled !== false);
    }
    if (next !== null && !['semanal', 'quincenal', 'mensual'].includes(next)) {
      return NextResponse.json({ error: 'runSchedule inválido' }, { status: 400 });
    }
    const brand = await setBrandRunSchedule(next);
    return NextResponse.json({
      ok: true,
      brandId: brand.id,
      name: brand.name,
      runSchedule: brand.runSchedule ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo guardar programación en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
