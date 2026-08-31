'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ExternalLink } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { MetricsKpiCard } from '@/components/metrics/metrics-kpi-card';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
import { fetchPublicationPerformance, resolvePublicationUrl } from '@/lib/api-client';
import type {
  AnalyticsPeriod,
  PublicationPerformanceReport,
} from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({
  label,
  ok,
}: {
  label: string;
  ok: boolean | null;
}) {
  if (ok === null) {
    return (
      <span className="rounded-full border border-hub-border/60 bg-[#0b1220] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-hub-muted">
        {label}: —
      </span>
    );
  }
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        ok
          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border border-amber-500/30 bg-amber-500/10 text-amber-100',
      )}
    >
      {label}: {ok ? 'ok' : 'error'}
    </span>
  );
}

export default function RendimientoPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [period, setPeriod] = useState<AnalyticsPeriod>(30);
  const [agent, setAgent] = useState<string | null>('teo');
  const [data, setData] = useState<PublicationPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPublicationPerformance(workspace, period, agent));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, agent]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = data?.kpis;

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cleexs-blue/30 bg-cleexs-blue/10 px-3 py-1 text-xs font-medium text-blue-200">
            <BarChart3 className="h-3.5 w-3.5" />
            Por publicación · por agente
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Rendimiento</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Impresiones, clicks, visitas y CTAs de cada artículo publicado. Filtrá por agente para
            medir el aporte de Teo (y futuros agentes).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-hub-border bg-[#0b1220] p-1">
            <button
              type="button"
              onClick={() => setAgent(null)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                agent === null
                  ? 'bg-cleexs-violet text-white'
                  : 'text-hub-muted hover:text-white',
              )}
            >
              Todos
            </button>
            {(data?.agents?.length
              ? data.agents
              : [{ slug: 'teo', name: 'Teo', publications: 0 }]
            ).map((a) => (
              <button
                key={a.slug}
                type="button"
                onClick={() => setAgent(a.slug)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  agent === a.slug
                    ? 'bg-cleexs-violet text-white'
                    : 'text-hub-muted hover:text-white',
                )}
              >
                {a.name}
                {a.publications > 0 ? (
                  <span className="ml-1 opacity-70">({a.publications})</span>
                ) : null}
              </button>
            ))}
          </div>
          <MetricsPeriodTabs value={period} onChange={setPeriod} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">No se pudieron cargar las métricas</p>
          <p className="mt-2 text-sm text-hub-muted">
            Verificá la API y las credenciales de Google en Integraciones.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-hub-muted">
            <span>
              Fuentes:{' '}
              {[
                data.sources.gsc ? 'GSC' : null,
                data.sources.ga4 ? 'GA4' : null,
                data.sources.cta ? 'CTA' : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'sin datos externos'}
            </span>
            <span>·</span>
            <span>Actualizado {new Date(data.updatedAt).toLocaleString('es-AR')}</span>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricsKpiCard
              label="Publicaciones"
              value={kpis!.publications}
              hint="Artículos con URL publicada"
            />
            <MetricsKpiCard
              label="Impresiones"
              value={kpis!.impressions}
              hint={`GSC · últimos ${period} días`}
            />
            <MetricsKpiCard
              label="Clicks"
              value={kpis!.clicks}
              hint={`GSC · últimos ${period} días`}
            />
            <MetricsKpiCard
              label="Visitas"
              value={kpis!.sessions}
              hint={`GA4 · últimos ${period} días`}
            />
            <MetricsKpiCard
              label="Eventos CTA"
              value={kpis!.ctaEvents}
              hint="Clicks + submits del bloque Cleexs"
            />
            <MetricsKpiCard
              label="Indexación OK"
              value={kpis!.indexedOk}
              hint="IndexNow o GSC submit ok"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
            <div className="border-b border-hub-border px-5 py-4">
              <h3 className="text-lg font-semibold text-white">Detalle por publicación</h3>
              <p className="mt-1 text-sm text-hub-muted">
                Ordenado por score (clicks ×3 + visitas + CTAs).
              </p>
            </div>

            {!data.rows.length ? (
              <p className="px-5 py-10 text-center text-sm text-hub-muted">
                No hay publicaciones{agent ? ` de ${agent}` : ''} todavía.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#0b1220]/80 text-xs uppercase tracking-wide text-hub-muted">
                    <tr>
                      <th className="px-5 py-3 font-medium">Artículo</th>
                      <th className="px-3 py-3 font-medium">Agente</th>
                      <th className="px-3 py-3 font-medium">Impresiones</th>
                      <th className="px-3 py-3 font-medium">Clicks</th>
                      <th className="px-3 py-3 font-medium">CTR</th>
                      <th className="px-3 py-3 font-medium">Visitas</th>
                      <th className="px-3 py-3 font-medium">CTA</th>
                      <th className="px-3 py-3 font-medium">Index</th>
                      <th className="px-5 py-3 font-medium">Publicado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hub-border/60">
                    {data.rows.map((row) => {
                      const publicUrl = resolvePublicationUrl(row.url, row.slug);
                      return (
                        <tr key={row.publicationId} className="hover:bg-white/[0.02]">
                          <td className="max-w-[280px] px-5 py-4">
                            <p className="truncate font-medium text-white">{row.title}</p>
                            {publicUrl ? (
                              <Link
                                href={publicUrl}
                                target="_blank"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-cleexs-blue hover:underline"
                              >
                                Ver <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : null}
                          </td>
                          <td className="px-3 py-4 text-slate-300">{row.agentName}</td>
                          <td className="px-3 py-4 tabular-nums text-slate-200">
                            {formatMetric(row.impressions)}
                          </td>
                          <td className="px-3 py-4 tabular-nums text-slate-200">
                            {formatMetric(row.clicks)}
                          </td>
                          <td className="px-3 py-4 tabular-nums text-slate-200">{row.ctr}%</td>
                          <td className="px-3 py-4 tabular-nums text-slate-200">
                            {formatMetric(row.sessions)}
                          </td>
                          <td className="px-3 py-4 tabular-nums text-slate-200">
                            {formatMetric(row.ctaClicks + row.ctaSubmits)}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-col gap-1">
                              <StatusPill
                                label="GSC"
                                ok={
                                  row.gscSubmitStatus == null
                                    ? null
                                    : row.gscSubmitStatus === 'ok'
                                }
                              />
                              <StatusPill
                                label="IN"
                                ok={
                                  row.indexNowStatus == null
                                    ? null
                                    : row.indexNowStatus === 'ok'
                                }
                              />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-hub-muted">{formatDate(row.publishedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-hub-muted">
            Tip: las piezas nuevas pueden tardar días en acumular impresiones en Search Console.
            Revisá también{' '}
            <Link href={workspaceHref(workspace, "resultados")} className="text-cleexs-blue hover:underline">
              Resultados
            </Link>{' '}
            para el overview del blog.
          </p>
        </>
      )}
    </CentroShell>
  );
}
