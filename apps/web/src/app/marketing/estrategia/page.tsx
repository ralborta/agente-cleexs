'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Loader2, Mail, Sparkles, Target, Trash2 } from 'lucide-react';
import { Badge, Card, Notice, PageHeader, btnGhost, btnGreen, btnPrimary, inputCls, useWorkspace } from '@/components/marketing/marketing-shell';
import {
  createMktCampaign, deleteMktCampaign, fetchMktOverview, generateMktEmail, updateMktCampaign,
  type MktOverview,
} from '@/lib/marketing-client';

const STATUS: Record<string, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }> = {
  proposed: { label: 'Propuesta', tone: 'violet' },
  approved: { label: 'Aprobada', tone: 'blue' },
  active: { label: 'Activa', tone: 'green' },
  finished: { label: 'Finalizada', tone: 'slate' },
  archived: { label: 'Archivada', tone: 'slate' },
};

export default function EstrategiaPage() {
  const workspace = useWorkspace();
  const [data, setData] = useState<MktOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchMktOverview(workspace)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar'); }
    finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { load(); }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setError(null); setMessage(null);
    try { await fn(); if (ok) setMessage(ok); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar'); }
    finally { setBusy(null); }
  }

  const calendar = useMemo(() => {
    if (!data) return [];
    return data.campaigns
      .filter((c) => c.startsAt || c.endsAt)
      .sort((a, b) => `${a.startsAt ?? ''}`.localeCompare(`${b.startsAt ?? ''}`));
  }, [data]);

  return (
    <>
      <PageHeader kicker="Agente · Estrategia de Marketing" title="Planificador de campañas">
        Analiza tus objetivos y las oportunidades que detecta Visibilidad, propone campañas y organiza el calendario de
        los demás agentes. Nada se ejecuta sin tu aprobación.
      </PageHeader>

      <Notice kind="ok" text={message} />
      <Notice kind="error" text={error} />

      {data && data.opportunities.length > 0 ? (
        <Card className="mb-6 border-violet-200 bg-violet-50/60">
          <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Target className="h-4 w-4 text-violet-600" /> Oportunidades detectadas por Visibilidad</h3>
          <p className="mt-1 text-sm text-slate-500">Convertí una oportunidad en campaña propuesta con un clic. El Planificador arma objetivo y público.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.opportunities.map((opp) => (
              <button key={opp.id} type="button" disabled={busy === opp.id}
                onClick={() => run(opp.id, () => createMktCampaign(workspace, { opportunityId: opp.id }), `Campaña creada desde "${opp.keyword}".`)}
                className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-[13px] font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-50">
                {busy === opp.id ? 'Creando…' : `+ ${opp.keyword}`}
              </button>
            ))}
          </div>
          <Link href="/marketing/visibilidad" className="mt-3 inline-block text-sm font-semibold text-violet-700 hover:underline">Ver todas en Visibilidad →</Link>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <h3 className="font-bold text-slate-900">Nueva campaña</h3>
          <p className="mt-1 text-sm text-slate-500">Definí objetivo y público; el Planificador la deja en estado Propuesta.</p>
          <div className="mt-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la campaña" className={inputCls} />
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} placeholder="Objetivo: qué queremos lograr y por qué ahora" className={inputCls} />
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Público / segmento (opcional)" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">Desde<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputCls} mt-1`} /></label>
              <label className="text-xs font-medium text-slate-500">Hasta<input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} mt-1`} /></label>
            </div>
            <button type="button" disabled={busy === 'new' || title.trim().length < 3 || objective.trim().length < 5}
              onClick={() => run('new', async () => {
                await createMktCampaign(workspace, { title, objective, audience: audience || undefined, startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null });
                setTitle(''); setObjective(''); setAudience(''); setStartsAt(''); setEndsAt('');
              }, 'Campaña propuesta. Revisala y aprobala.')}
              className={btnPrimary}>
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Proponer campaña
            </button>
          </div>

          {calendar.length > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h4 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarRange className="h-4 w-4 text-blue-600" /> Calendario de acciones</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {calendar.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="truncate font-medium text-slate-700">{c.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {c.startsAt ? new Date(c.startsAt).toLocaleDateString('es-AR') : '—'} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString('es-AR') : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4 xl:col-span-3">
          {loading && !data ? <p className="text-sm text-slate-500">Cargando campañas…</p> : null}
          {data?.campaigns.length === 0 ? (
            <Card><p className="text-sm text-slate-500">Todavía no hay campañas. Creá la primera desde una oportunidad o con el formulario.</p></Card>
          ) : data?.campaigns.map((c) => {
            const st = STATUS[c.status] ?? { label: c.status, tone: 'slate' as const };
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-400">{c.sourceLabel ? `Desde oportunidad: ${c.sourceLabel}` : 'Creación manual'} · {c._count?.offers ?? 0} ofertas · {c._count?.emails ?? 0} emails</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.objective}</p>
                {c.audience ? <p className="mt-1 text-[13px] text-slate-500">Público: {c.audience}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status === 'proposed' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'approved' }), 'Campaña aprobada.')} className={btnGreen}><CheckCircle2 className="h-3.5 w-3.5" /> Aprobar</button> : null}
                  {c.status === 'approved' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'active' }), 'Campaña activa.')} className={btnGhost}>Activar</button> : null}
                  {c.status === 'active' ? <button type="button" disabled={busy === c.id} onClick={() => run(c.id, () => updateMktCampaign(workspace, c.id, { status: 'finished' }))} className={btnGhost}>Finalizar</button> : null}
                  <button type="button" disabled={busy === `mail-${c.id}`} onClick={() => run(`mail-${c.id}`, () => generateMktEmail(workspace, c.id), 'Email en borrador creado. Revisalo en Campañas de email.')} className={btnGhost}><Mail className="h-3.5 w-3.5" /> Generar email</button>
                  <Link href="/marketing/ofertas" className={btnGhost}>Crear oferta</Link>
                  <button type="button" disabled={busy === `del-${c.id}`} onClick={() => run(`del-${c.id}`, () => deleteMktCampaign(workspace, c.id))} className="ml-auto text-slate-300 hover:text-red-500" aria-label="Eliminar campaña"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
