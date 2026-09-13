'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { AiSourcesPanel } from '@/components/metrics/ai-sources-panel';
import { DailyTrafficChart } from '@/components/metrics/daily-traffic-chart';
import { FeaturedMetricCard } from '@/components/metrics/featured-metric-card';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
import { TopArticlesPanel } from '@/components/metrics/top-articles-panel';
import { KpiGrid } from '@/components/centro/kpi-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  createMission,
  fetchAnalytics,
  resolvePublicationUrl,
} from '@/lib/api-client';
import type { AnalyticsDashboard, AnalyticsPeriod } from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';
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
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [period, setPeriod] = useState<AnalyticsPeriod>(30);
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAnalytics(workspace, period));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspace, period]);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerMission() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await createMission(workspace);
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
    <CentroShell workspaceName={workspaceName}>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.28),_transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(249,115,22,0.08))]" />
        <div className="relative px-6 py-8 md:px-8">
          <p className="text-sm font-semibold tracking-[0.22em] text-cleexs-blue">CLEEXS · TEO</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Resultados</h2>
            <Badge variant="info" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Panel nuevo
            </Badge>
          </div>
          <p className="mt-3 max-w-2xl text-base text-hub-muted">
            Impacto del blog de {TEO_AUTHOR_NAME}: tráfico IA, Google y piezas publicadas.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <MetricsPeriodTabs value={period} onChange={setPeriod} />
            <Button
              type="button"
              onClick={triggerMission}
              disabled={running}
              size="lg"
              className="bg-cleexs-orange hover:bg-cleexs-orange/90"
            >
              {running ? 'Ejecutando…' : 'Disparar misión Teo'}
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={workspaceHref(workspace, 'rendimiento')}>Ver por artículo</Link>
            </Button>
          </div>
        </div>
      </div>

      {message ? (
        <Card className="mb-4 border-cleexs-blue/30 bg-cleexs-blue/10">
          <CardContent className="p-4 text-sm text-blue-200">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-white">No se pudieron cargar las métricas</p>
            <p className="mt-2 text-sm text-hub-muted">
              Verificá la API y las credenciales de Google en Easypanel.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
              Señales principales
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <FeaturedMetricCard
                label={kpis!.aiSessions.label}
                value={kpis!.aiSessions.value}
                change={kpis!.aiSessions.change}
                tone="violet"
              />
              <FeaturedMetricCard
                label={kpis!.totalSessions.label}
                value={kpis!.totalSessions.value}
                change={kpis!.totalSessions.change}
                tone="teal"
              />
              <FeaturedMetricCard
                label={kpis!.aiShare.label}
                value={kpis!.aiShare.value}
                change={kpis!.aiShare.change}
                tone="blue"
              />
            </div>
          </section>

          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
              Search + producción
            </p>
            <KpiGrid
              items={[
                {
                  label: kpis!.clicks.label,
                  value: formatMetric(kpis!.clicks.value),
                  trend:
                    kpis!.clicks.change != null
                      ? `${kpis!.clicks.change > 0 ? '+' : ''}${kpis!.clicks.change}%`
                      : undefined,
                },
                {
                  label: kpis!.impressions.label,
                  value: formatMetric(kpis!.impressions.value),
                  trend:
                    kpis!.impressions.change != null
                      ? `${kpis!.impressions.change > 0 ? '+' : ''}${kpis!.impressions.change}%`
                      : undefined,
                },
                {
                  label: kpis!.publications.label,
                  value: formatMetric(kpis!.publications.value),
                  hint: 'Piezas Teo',
                  href: workspaceHref(workspace, 'publicaciones'),
                },
              ]}
            />
          </section>

          {data.insight.newArticlesThisPeriod > 0 ? (
            <Card className="border-cleexs-orange/30 bg-cleexs-orange/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-cleexs-orange/20 p-2 text-orange-100">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{data.insight.message}</p>
                    <p className="mt-1 text-xs text-hub-muted">
                      Seguí el rendimiento por artículo abajo o en Rendimiento.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={workspaceHref(workspace, 'publicaciones')}>Ver artículos</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="animate-centro-in">
            <CardHeader>
              <CardTitle className="text-xl">Evolución diaria de visitas</CardTitle>
              <CardDescription>
                Blog `/articulos/` · motores IA vs Google · últimos {period} días
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DailyTrafficChart data={data.dailySeries} />
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="animate-centro-in" style={{ animationDelay: '80ms' }}>
              <CardHeader>
                <CardTitle>Origen del tráfico</CardTitle>
                <CardDescription>Clasificación por referrer en GA4</CardDescription>
              </CardHeader>
              <CardContent>
                <AiSourcesPanel sources={data.aiSources} totalSessions={kpis!.totalSessions.value} />
              </CardContent>
            </Card>

            <Card className="animate-centro-in" style={{ animationDelay: '120ms' }}>
              <CardHeader>
                <CardTitle>Top artículos</CardTitle>
                <CardDescription>Clicks en Google + visitas al blog</CardDescription>
              </CardHeader>
              <CardContent>
                <TopArticlesPanel articles={data.topArticles} />
              </CardContent>
            </Card>
          </div>

          <Card className="animate-centro-in" style={{ animationDelay: '160ms' }}>
            <CardHeader>
              <CardTitle>Publicaciones recientes</CardTitle>
              <CardDescription>Últimas piezas de {TEO_AUTHOR_NAME}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentPublications.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.recentPublications.map((pub) => {
                    const publicUrl = resolvePublicationUrl(pub.url, pub.slug);
                    return (
                      <div
                        key={pub.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-hub-border/60 bg-[#0b1220]/50 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{pub.title}</p>
                          {pub.publishedAt ? (
                            <p className="mt-1 text-xs text-hub-muted">
                              {new Date(pub.publishedAt).toLocaleDateString('es-AR')}
                            </p>
                          ) : null}
                        </div>
                        {publicUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={publicUrl} target="_blank" rel="noopener">
                              WP
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-hub-muted">Aún no hay publicaciones.</p>
              )}
            </CardContent>
          </Card>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hub-border/60 pt-5 text-xs text-hub-muted">
            <p>
              Fuente: Google Search Console
              {data.sources.ga4 ? ' + GA4' : ''} · Agente Cleexs
            </p>
            <p>Actualizado: {formatUpdatedAt(data.updatedAt)}</p>
          </footer>
        </div>
      )}
    </CentroShell>
  );
}
