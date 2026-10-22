'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bot, Loader2, Search, Sparkles } from 'lucide-react';
import { Badge, Card, Notice, PageHeader, Stat, useWorkspace } from '@/components/marketing/marketing-shell';
import { createMktCampaign, fetchMktVisibilidad, type MktVisibilidad } from '@/lib/marketing-client';

const STAGE: Record<string, string> = { tofu: 'Descubrimiento', mofu: 'Evaluación', bofu: 'Decisión' };
const STATUS: Record<string, string> = { idea: 'Idea', queued: 'En cola', in_progress: 'En curso', covered: 'Cubierta', discarded: 'Descartada' };

export default function VisibilidadPage() {
  const workspace = useWorkspace();
  const router = useRouter();
  const [data, setData] = useState<MktVisibilidad | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMktVisibilidad(workspace).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [workspace]);

  async function toCampaign(id: string, keyword: string) {
    setBusy(id); setError(null); setMessage(null);
    try {
      await createMktCampaign(workspace, { opportunityId: id });
      setMessage(`Campaña creada desde "${keyword}". El Planificador ya la tiene en Propuestas.`);
      router.push('/marketing/estrategia');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la campaña');
      setBusy(null);
    }
  }

  const open = data?.opportunities.filter((o) => o.status === 'idea' || o.status === 'queued') ?? [];
  const cleexs = data?.cleexs;

  async function toCampaignFromWeak(prompt: string, top: string[]) {
    setBusy(prompt); setError(null); setMessage(null);
    try {
      await createMktCampaign(workspace, {
        title: `Campaña: ${prompt.slice(0, 80)}`,
        objective: `La marca no aparece en la respuesta de IA a esta consulta real medida por Cleexs: "${prompt}". Hoy aparecen: ${top.join(', ') || 'otras marcas'}. Objetivo: crear el contenido y las menciones para empezar a aparecer.`,
        audience: 'Personas que hacen esta consulta en motores de IA',
      });
      setMessage('Campaña creada desde una consulta real de Cleexs. El Planificador ya la tiene en Propuestas.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la campaña');
    } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader kicker="Agente de Posicionamiento y Visibilidad" title="Rankear">
        Monitorea dónde aparece tu marca, compara con competidores y detecta las consultas donde deberías estar.
        Este es el radar que alimenta al Planificador: cada oportunidad puede convertirse en campaña.
      </PageHeader>

      <Notice kind="ok" text={message} />
      <Notice kind="error" text={error} />
      {!data && !error ? <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando visibilidad…</p> : data ? (
        <>

      {cleexs && !cleexs.configured ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Datos de Cleexs sin conectar.</strong> {cleexs.reason} Abajo ves los datos de este sistema (Google y demanda); el Cleexs Score, los competidores y las consultas por intención se muestran cuando Cleexs tiene la marca medida.
        </div>
      ) : null}

      {cleexs?.configured ? (
        <div className="mb-6 space-y-4">
          <Card className="border-blue-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Datos reales de Cleexs</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{cleexs.snapshot.brand.name} <span className="text-base font-medium text-slate-400">{cleexs.snapshot.brand.domain ?? ''}</span></h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {cleexs.snapshot.brand.category ?? cleexs.snapshot.brand.industry ?? 'Marca medida por Cleexs'}
                  {cleexs.snapshot.brand.competitors.length ? ` · Competidores medidos: ${cleexs.snapshot.brand.competitors.map((c) => c.name).join(', ')}` : ''}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cleexs Score</p>
                <p className="text-5xl font-extrabold leading-none text-blue-600">{cleexs.snapshot.cleexsScore != null ? Math.round(cleexs.snapshot.cleexsScore) : '—'}</p>
                <p className="mt-1 text-xs text-slate-400">0 a 100 · última corrida Cleexs</p>
              </div>
            </div>
            {cleexs.snapshot.latest ? (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-center"><p className="text-2xl font-bold text-slate-900">{cleexs.snapshot.latest.promptsAnalyzed}</p><p className="text-xs text-slate-400">Consultas analizadas</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-center"><p className="text-2xl font-bold text-slate-900">{cleexs.snapshot.latest.brandInTop3Pct}%</p><p className="text-xs text-slate-400">Aparición en top 3 ({cleexs.snapshot.latest.brandInTop3})</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-center"><p className="text-2xl font-bold text-slate-900">{cleexs.snapshot.latest.brandPosition1}</p><p className="text-xs text-slate-400">Veces recomendado primero</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-center"><p className="text-2xl font-bold text-slate-900">{cleexs.snapshot.history.length}</p><p className="text-xs text-slate-400">Corridas medidas</p></div>
              </div>
            ) : <p className="mt-3 text-sm text-slate-500">La marca existe en Cleexs pero todavía no tiene corridas con reporte.</p>}
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-bold text-slate-900">Score por intención (Cleexs)</h3>
              {cleexs.snapshot.latest && cleexs.snapshot.latest.scoreByIntention.length > 0 ? (
                <ul className="space-y-2.5">
                  {cleexs.snapshot.latest.scoreByIntention.map((row) => (
                    <li key={row.intention}>
                      <div className="mb-1 flex items-center justify-between text-[13px]"><span className="text-slate-600">{row.intention}</span><span className="font-semibold tabular-nums text-slate-900">{Math.round(row.score)}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, row.score))}%` }} /></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Sin desglose por intención en la última corrida.</p>}
              {cleexs.snapshot.latest && cleexs.snapshot.latest.competitorMentions.length > 0 ? (
                <>
                  <h4 className="mb-2 mt-5 text-sm font-bold text-slate-900">Apariciones de competidores en IA</h4>
                  <ul className="space-y-1.5 text-sm">
                    {cleexs.snapshot.latest.competitorMentions.map((c) => (
                      <li key={c.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span className="text-slate-600">{c.name}</span><span className="tabular-nums text-slate-500">{c.appearances} apariciones · pos. prom. {c.averagePosition}</span></li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>

            <Card>
              <h3 className="mb-1 font-bold text-slate-900">Consultas donde tu marca no aparece</h3>
              <p className="mb-3 text-sm text-slate-500">Consultas reales medidas por Cleexs. Cada una puede convertirse en campaña del Planificador.</p>
              {cleexs.snapshot.latest && cleexs.snapshot.latest.weakPrompts.length > 0 ? (
                <ul className="space-y-3">
                  {cleexs.snapshot.latest.weakPrompts.map((w) => (
                    <li key={w.prompt} className="rounded-xl border border-slate-100 px-3 py-3">
                      <p className="text-sm font-medium leading-snug text-slate-800">{w.prompt}</p>
                      <p className="mt-1 text-xs text-slate-400">{w.intention ? `${w.intention} · ` : ''}Hoy aparecen: {w.top.join(', ') || 'otras marcas'}</p>
                      <button type="button" disabled={busy === w.prompt} onClick={() => toCampaignFromWeak(w.prompt, w.top)}
                        className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                        {busy === w.prompt ? 'Creando…' : 'Crear campaña'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Tu marca aparece en todas las consultas analizadas. </p>}
            </Card>
          </div>
        </div>
      ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Search className="h-4 w-4 text-blue-600" /> Google</h3>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div><p className="text-2xl font-bold text-slate-900">{data.google.impressions.toLocaleString('es-AR')}</p><p className="text-xs text-slate-400">Impresiones GSC</p></div>
                <div><p className="text-2xl font-bold text-slate-900">{data.google.clicks.toLocaleString('es-AR')}</p><p className="text-xs text-slate-400">Clics GSC</p></div>
                <div><p className="text-2xl font-bold text-slate-900">{data.google.searches.toLocaleString('es-AR')}</p><p className="text-xs text-slate-400">Búsquedas/mes</p></div>
              </div>
            </Card>
            <Card>
              <h3 className="inline-flex items-center gap-2 font-bold text-slate-900"><Bot className="h-4 w-4 text-violet-600" /> IA y demanda</h3>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div><p className="text-2xl font-bold text-slate-900">{open.length}</p><p className="text-xs text-slate-400">Oportunidades abiertas</p></div>
                <div><p className="text-2xl font-bold text-slate-900">{data.questions.length}</p><p className="text-xs text-slate-400">Preguntas reales</p></div>
                <div><p className="text-2xl font-bold text-slate-900">{new Set(data.opportunities.map((o) => o.cluster)).size}</p><p className="text-xs text-slate-400">Clusters de temas</p></div>
              </div>
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Oportunidades abiertas" value={open.length} hint="Sin campaña todavía" />
            <Stat label="En curso / cubiertas" value={data.opportunities.filter((o) => o.status === 'in_progress' || o.status === 'covered').length} />
            <Stat label="Clusters" value={new Set(data.opportunities.map((o) => o.cluster)).size} />
            <Stat label="Preguntas de usuarios" value={data.questions.length} hint="Mapa FAQ potencial" />
          </div>

          <Card>
            <h3 className="mb-1 inline-flex items-center gap-2 font-bold text-slate-900"><Sparkles className="h-4 w-4 text-blue-600" /> Oportunidades detectadas</h3>
            <p className="mb-3 text-sm text-slate-500">Ordenadas por puntaje. “Crear campaña” se la pasa al Planificador con objetivo y público armados.</p>
            {data.opportunities.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay oportunidades cargadas para este workspace.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2.5 pr-4 font-medium">Consulta / tema</th>
                      <th className="py-2.5 pr-4 font-medium">Etapa</th>
                      <th className="py-2.5 pr-4 font-medium">Búsquedas</th>
                      <th className="py-2.5 pr-4 font-medium">Puntaje</th>
                      <th className="py-2.5 pr-4 font-medium">Google (imp · clics)</th>
                      <th className="py-2.5 pr-4 font-medium">Estado</th>
                      <th className="py-2.5 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.opportunities.map((o) => (
                      <tr key={o.id} className="border-b border-slate-50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-slate-900">{o.keyword}</p>
                          <p className="text-xs text-slate-400">{o.cluster}{o.intentLabel ? ` · ${o.intentLabel}` : ''}</p>
                        </td>
                        <td className="py-3 pr-4"><Badge tone="blue">{STAGE[o.stage] ?? o.stage}</Badge></td>
                        <td className="py-3 pr-4 tabular-nums text-slate-600">{o.monthlySearches?.toLocaleString('es-AR') ?? '—'}</td>
                        <td className="py-3 pr-4 font-semibold tabular-nums text-slate-900">{o.opportunityScore ?? o.priority}</td>
                        <td className="py-3 pr-4 tabular-nums text-slate-500">{o.gscImpressions != null || o.gscClicks != null ? `${o.gscImpressions ?? 0} · ${o.gscClicks ?? 0}` : '—'}</td>
                        <td className="py-3 pr-4 text-slate-500">{STATUS[o.status] ?? o.status}</td>
                        <td className="py-3">
                          {(o.status === 'idea' || o.status === 'queued') ? (
                            <button type="button" disabled={busy === o.id} onClick={() => toCampaign(o.id, o.keyword)}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                              {busy === o.id ? 'Creando…' : 'Crear campaña'}
                            </button>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.questions.length > 0 ? (
            <Card className="mt-4">
              <h3 className="mb-3 font-bold text-slate-900">Preguntas reales de usuarios</h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {data.questions.slice(0, 12).map((q) => (
                  <li key={q.id} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {q.question}
                    <span className="mt-0.5 block text-xs text-slate-400">{q.cluster} · ajuste de negocio {q.businessFit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
