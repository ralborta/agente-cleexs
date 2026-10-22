'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Trash2 } from 'lucide-react';
import { Badge, Card, Notice, PageHeader, btnGhost, btnGreen, useWorkspace } from '@/components/marketing/marketing-shell';
import { deleteMktEmail, fetchMktOverview, generateMktEmail, updateMktEmail, type MktOverview } from '@/lib/marketing-client';

export default function EmailPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await fetchMktOverview(workspace)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar'); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setError(null); setMessage(null);
    try { await fn(); if (ok) setMessage(ok); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar'); }
    finally { setBusy(null); }
  }

  const campaignsById = new Map(data?.campaigns.map((c) => [c.id, c.title]) ?? []);

  return (
    <>
      <PageHeader kicker="Agente · Email Marketing" title="Campañas de email">
        Crea campañas personalizadas de novedades, ofertas, seguimiento y reactivación. El agente redacta la secuencia y
        la deja en borrador: aprobar no envía nada hasta que conectes tu dominio.
      </PageHeader>

      <Notice kind="ok" text={message} />
      <Notice kind="error" text={error} />
      {data && !data.sendingEnabled ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Mail className="mr-2 inline h-4 w-4" /> {data.sendingNote}
        </div>
      ) : null}

      <Card className="mb-6">
        <h3 className="font-bold text-slate-900">Generar un email desde una campaña</h3>
        <p className="mt-1 text-sm text-slate-500">Si la campaña tiene una oferta aprobada, el email la incluye con precio y vigencia.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data?.campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">Primero creá una campaña en el <Link href="/marketing/estrategia" className="font-semibold text-blue-600 hover:underline">Planificador</Link>.</p>
          ) : data?.campaigns.map((c) => (
            <button key={c.id} type="button" disabled={busy === c.id}
              onClick={() => run(c.id, () => generateMktEmail(workspace, c.id), 'Borrador creado abajo.')}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[13px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50">
              {busy === c.id ? 'Generando…' : `+ Email para: ${c.title}`}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {data?.emails.length === 0 ? (
          <Card><p className="text-sm text-slate-500">Sin borradores todavía. Generá el primero desde una campaña.</p></Card>
        ) : data?.emails.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{m.subject}</p>
                <p className="text-xs text-slate-400">
                  Segmento: {m.segment}
                  {m.campaignId && campaignsById.get(m.campaignId) ? ` · Campaña: ${campaignsById.get(m.campaignId)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={m.status === 'approved' ? 'green' : m.status === 'discarded' ? 'red' : 'amber'}>
                  {m.status === 'approved' ? 'Aprobado · sin envío' : m.status === 'discarded' ? 'Descartado' : 'Borrador'}
                </Badge>
                <button type="button" onClick={() => run(`del-${m.id}`, () => deleteMktEmail(workspace, m.id))} className="text-slate-300 hover:text-red-500" aria-label="Eliminar email"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {m.preheader ? <p className="mt-1 text-[13px] italic text-slate-400">{m.preheader}</p> : null}
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-600">{m.body}</pre>
            {m.status === 'draft' ? (
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busy === m.id} onClick={() => run(m.id, () => updateMktEmail(workspace, m.id, { status: 'approved' }), 'Email aprobado. No se envía hasta conectar tu dominio.')} className={btnGreen}>
                  {busy === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Aprobar borrador
                </button>
                <button type="button" disabled={busy === m.id} onClick={() => run(m.id, () => updateMktEmail(workspace, m.id, { status: 'discarded' }))} className={btnGhost}>Descartar</button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
