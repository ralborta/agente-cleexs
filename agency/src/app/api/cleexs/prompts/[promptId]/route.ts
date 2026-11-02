import { NextResponse } from 'next/server';
import { cleexsApiUrl } from '@/lib/cleexs.server';

export const dynamic = 'force-dynamic';

/**
 * Editar / borrar prompts auditados.
 * Mientras Cleexs API (Railway) no tenga PATCH/DELETE desplegado, Agency aplica el cambio
 * en el proyecto (override local) y responde ok para no bloquear al especialista.
 */
export async function PATCH(req: Request, ctx: { params: { promptId: string } }) {
  try {
    const promptId = ctx.params.promptId;
    const payload = await req.json();
    const res = await fetch(`${cleexsApiUrl()}/api/prompts/prompts/${promptId}`, {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (res.ok) {
      const prompt = await res.json();
      return NextResponse.json({ ok: true, prompt, persisted: 'cleexs' });
    }
    // Fallback Agency: el front ya guarda override local
    return NextResponse.json({
      ok: true,
      persisted: 'agency',
      promptId,
      patch: payload,
      detail: `Cleexs aún no expone PATCH (${res.status}). Cambio aplicado en Agency.`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      persisted: 'agency',
      promptId: ctx.params.promptId,
      detail: (e as Error).message,
    });
  }
}

export async function DELETE(_req: Request, ctx: { params: { promptId: string } }) {
  try {
    const promptId = ctx.params.promptId;
    const res = await fetch(`${cleexsApiUrl()}/api/prompts/prompts/${promptId}`, {
      method: 'DELETE',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: true, persisted: 'cleexs', ...body });
    }
    return NextResponse.json({
      ok: true,
      persisted: 'agency',
      promptId,
      detail: `Cleexs aún no expone DELETE (${res.status}). Ocultado en Agency.`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      persisted: 'agency',
      promptId: ctx.params.promptId,
      detail: (e as Error).message,
    });
  }
}
