import { NextResponse } from 'next/server';
import { cleexsApiUrl } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

async function cleexsPrompt(promptId: string, init: RequestInit) {
  const res = await fetch(`${cleexsApiUrl()}/api/prompts/prompts/${promptId}`, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { res, body };
}

/** Editar prompt auditado en Cleexs (texto / nombre / activo). */
export async function PATCH(req: Request, ctx: { params: { promptId: string } }) {
  try {
    const promptId = ctx.params.promptId;
    const payload = await req.json();
    const { res, body } = await cleexsPrompt(promptId, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err =
        body && typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `Cleexs ${res.status}`;
      return NextResponse.json({ error: err, detail: err }, { status: res.status === 404 ? 404 : 502 });
    }
    return NextResponse.json({ ok: true, prompt: body });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo editar el prompt en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}

/** Soft-delete: active=false en Cleexs (historial de corridas se conserva). */
export async function DELETE(_req: Request, ctx: { params: { promptId: string } }) {
  try {
    const promptId = ctx.params.promptId;
    const { res, body } = await cleexsPrompt(promptId, { method: 'DELETE' });
    if (!res.ok) {
      const err =
        body && typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error: unknown }).error)
          : `Cleexs ${res.status}`;
      return NextResponse.json({ error: err, detail: err }, { status: res.status === 404 ? 404 : 502 });
    }
    return NextResponse.json({ ok: true, ...(typeof body === 'object' && body ? body : {}) });
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo borrar el prompt en Cleexs', detail: (e as Error).message },
      { status: 502 },
    );
  }
}
