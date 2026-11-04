import { NextResponse } from 'next/server';
import { cleexsApiUrl, cleexsBrandId } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

/** Diagnóstico: confirma a qué API apunta Agency y si responde JSON. */
export async function GET() {
  const api = cleexsApiUrl();
  const brandId = cleexsBrandId();
  const path = `/api/brands/${brandId}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(`${api}${path}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: ac.signal,
    });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    const isJson = ct.includes('application/json') && !text.trimStart().startsWith('<');
    let brandName: string | null = null;
    if (isJson) {
      try {
        brandName = (JSON.parse(text) as { name?: string }).name ?? null;
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({
      ok: res.ok && isJson,
      cleexsApiUrl: api,
      brandId,
      upstreamStatus: res.status,
      upstreamContentType: ct,
      brandName,
      looksLikeHtml: text.trimStart().startsWith('<'),
    });
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError';
    return NextResponse.json(
      {
        ok: false,
        cleexsApiUrl: api,
        brandId,
        error: aborted
          ? 'timeout alcanzando Cleexs API (EasyPanel→Railway bloqueado)'
          : (e as Error).message,
        networkHint:
          'Desde este VPS EasyPanel no hay ruta TCP a *.up.railway.app. Usar dominio con proxy Cloudflare u otro edge alcanzable.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
