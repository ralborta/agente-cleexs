'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { AiSourcesPanel } from '@/components/metrics/ai-sources-panel';
import { DailyTrafficChart } from '@/components/metrics/daily-traffic-chart';
import { MetricsKpiCard } from '@/components/metrics/metrics-kpi-card';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
import { TopArticlesPanel } from '@/components/metrics/top-articles-panel';
import {
  createMission,
  fetchAnalytics,
  resolvePublicationUrl,
} from '@/lib/api-client';
import type { AnalyticsDashboard, AnalyticsPeriod } from '@/lib/analytics-types';
import { TEO_AUTHOR_NAME } from '@/lib/branding';

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResultadosPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>(30);
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAnalytics('cleexs', period));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerMission() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await createMission('cleexs');
      setMessage(`Misión "${res.mission.title}" en ejecución…`);
      setTimeout(load, 3000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  const kpis = data?.kpis;

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cleexs-violet/30 bg-cleexs-violet/10 px-3 py-1 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Rendimiento del agente de blog
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">Resultados</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Visitas, clicks e impresiones del blog de {TEO_AUTHOR_NAME} en cleexs.net · datos de Google Search
            Console y Analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MetricsPeriodTabs value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={triggerMission}
            disabled={running}
            className="rounded-xl bg-cleexs-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {running ? 'Ejecutando…' : 'Disparar misión Teo'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-cleexs-blue/30 bg-cleexs-blue/10 px-4 py-3 text-sm text-blue-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
            ))}
          </div>
          <div className="h-[360px] animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">No se pudieron cargar las métricas</p>
          <p className="mt-2 text-sm text-hub-muted">Verificá la API y las credenciales de Google en Easypanel.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricsKpiCard
              label={kpis!.aiSessions.label}
              value={kpis!.aiSessions.value}
              change={kpis!.aiSessions.change}
              accent="violet"
            />
            <MetricsKpiCard
              label={kpis!.totalSessions.label}
              value={kpis!.totalSessions.value}
              change={kpis!.totalSessions.change}
              accent="teal"
            />
            <MetricsKpiCard
              label={kpis!.aiShare.label}
              value={kpis!.aiShare.value}
              change={kpis!.aiShare.change}
              suffix=" pts vs período anterior"
              accent="blue"
            />
            <MetricsKpiCard
              label={kpis!.clicks.label}
              value={kpis!.clicks.value}
              change={kpis!.clicks.change}
            />
            <MetricsKpiCard
              label={kpis!.impressions.label}
              value={kpis!.impressions.value}
              change={kpis!.impressions.change}
            />
            <MetricsKpiCard
              label={kpis!.publications.label}
              value={kpis!.publications.value}
              change={kpis!.publications.change}
              accent="orange"
            />
          </div>

          {data.insight.newArticlesThisPeriod > 0 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cleexs-violet/25 bg-gradient-to-r from-cleexs-violet/10 via-cleexs-blue/5 to-transparent px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cleexs-violet/20 p-2 text-violet-200">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{data.insight.message}</p>
                  <p className="mt-1 text-xs text-hub-muted">
                    Seguí el rendimiento por artículo en el ranking de abajo.
                  </p>
                </div>
              </div>
              <Link
                href="/cleexs/publicaciones"
                className="text-sm font-semibold text-cleexs-blue hover:underline"
              >
                Ver artículos →
              </Link>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <section className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Evolución diaria de visitas</h3>
                  <p className="mt-1 text-sm text-hub-muted">
                    Blog `/articulos/` · motores IA vs Google · últimos {period} días
                  </p>
                </div>
              </div>
              <DailyTrafficChart data={data.dailySeries} />
            </section>

            <section className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white">Origen del tráfico</h3>
                <p className="mt-1 text-sm text-hub-muted">Clasificación por referrer en GA4</p>
              </div>
              <AiSourcesPanel sources={data.aiSources} totalSessions={kpis!.totalSessions.value} />
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <section className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white">Top artículos</h3>
                <p className="mt-1 text-sm text-hub-muted">Clicks en Google + visitas al blog por pieza</p>
              </div>
              <TopArticlesPanel articles={data.topArticles} />
            </section>

            <section className="rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white">Publicaciones recientes</h3>
                <p className="mt-1 text-sm text-hub-muted">Últimas piezas publicadas por {TEO_AUTHOR_NAME}</p>
              </div>
              {data.recentPublications.length ? (
                <ul className="space-y-3">
                  {data.recentPublications.map((pub) => {
                    const publicUrl = resolvePublicationUrl(pub.url, pub.slug);
                    return (
                      <li
                        key={pub.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{pub.title}</p>
                          {pub.publishedAt ? (
                            <p className="mt-0.5 text-xs text-hub-muted">
                              {new Date(pub.publishedAt).toLocaleDateString('es-AR')}
                            </p>
                          ) : null}
                        </div>
                        {publicUrl ? (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener"
                            className="shrink-0 text-xs font-semibold text-cleexs-blue hover:underline"
                          >
                            Ver en WP
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-hub-muted">Aún no hay publicaciones.</p>
              )}
            </section>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-hub-border/60 pt-5 text-xs text-hub-muted">
            <p>
              Fuente: Google Search Console
              {data.sources.ga4 ? ' + Google Analytics 4 (GA4)' : ''} · Agente Cleexs
            </p>
            <p>Actualizado: {formatUpdatedAt(data.updatedAt)}</p>
          </footer>
        </>
      )}
    </CentroShell>
  );
}
