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
