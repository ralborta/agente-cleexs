'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { PageHero } from '@/components/shell/page-hero';
import { AiSourcesPanel } from '@/components/metrics/ai-sources-panel';
import { DailyTrafficChart } from '@/components/metrics/daily-traffic-chart';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
import { TopArticlesPanel } from '@/components/metrics/top-articles-panel';
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
import { cn } from '@/lib/utils';

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ScoreCell({
  label,
  value,
  change,
  className,
}: {
  label: string;
  value: number;
  change?: number | null;
  className?: string;
}) {
  const positive = change !== null && change !== undefined && change >= 0;
  return (
    <div className={cn('px-5 py-6 md:px-6', className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/80">{label}</p>
      <p className="mt-3 text-5xl font-semibold tabular-nums text-white md:text-6xl">
        {formatMetric(value)}
      </p>
      {change !== null && change !== undefined ? (
        <p className={cn('mt-3 text-sm font-semibold', positive ? 'text-emerald-300' : 'text-rose-300')}>
          {positive ? '▲' : '▼'} {change > 0 ? '+' : ''}
          {change}% vs período anterior
        </p>
      ) : (
        <p className="mt-3 text-sm text-blue-100/60">Sin comparación</p>
      )}
    </div>
  );
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
      <PageHero
        kicker="Cleexs · Scoreboard Teo"
        title="Resultados"
        badge="UI v3"
        description={`Impacto del blog de ${TEO_AUTHOR_NAME}: tráfico IA, Google y piezas publicadas.`}
        actions={
          <>
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
          </>
        }
      />

      {message ? (
        <Card className="mb-4 border-cleexs-blue/30 bg-cleexs-blue/10">
          <CardContent className="p-4 text-sm text-blue-200">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
      ) : !data || !kpis ? (
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
          {/* SCOREBOARD — cambio visual imposible de confundir */}
          <section className="overflow-hidden rounded-2xl border border-cleexs-blue/40 bg-gradient-to-br from-[#0b1f4a] via-[#0f172a] to-[#1a0f14] shadow-hub">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">
                Scoreboard · últimos {period} días
              </p>
              <Badge className="bg-white/10 text-white hover:bg-white/10">Teo en vivo</Badge>
            </div>
            <div className="grid md:grid-cols-3 md:divide-x md:divide-white/10">
              <ScoreCell
                label={kpis.aiSessions.label}
                value={kpis.aiSessions.value}
                change={kpis.aiSessions.change}
              />
              <ScoreCell
                label={kpis.totalSessions.label}
                value={kpis.totalSessions.value}
                change={kpis.totalSessions.change}
              />
              <ScoreCell
                label={kpis.aiShare.label}
                value={kpis.aiShare.value}
                change={kpis.aiShare.change}
              />
            </div>
            <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10">
              {[
                { label: 'Clicks', value: kpis.clicks.value, change: kpis.clicks.change },
                { label: 'Impresiones', value: kpis.impressions.value, change: kpis.impressions.change },
                { label: 'Publicaciones', value: kpis.publications.value, change: kpis.publications.change },
              ].map((item) => (
                <div key={item.label} className="bg-[#0b1220]/90 px-4 py-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-hub-muted">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                    {formatMetric(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {data.insight.newArticlesThisPeriod > 0 ? (
            <Card className="border-cleexs-orange/40 bg-cleexs-orange/15">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-cleexs-orange/30 p-2 text-orange-50">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{data.insight.message}</p>
                    <p className="mt-1 text-sm text-orange-100/80">
                      Revisá el ranking de artículos o andá a Rendimiento.
                    </p>
                  </div>
                </div>
                <Button asChild className="bg-cleexs-orange hover:bg-cleexs-orange/90">
                  <Link href={workspaceHref(workspace, 'publicaciones')}>Ver artículos</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Bento: chart wide + sources */}
          <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
            <Card className="border-cleexs-blue/25">
              <CardHeader>
                <CardTitle className="text-2xl">Evolución diaria</CardTitle>
                <CardDescription>
                  Blog `/articulos/` · IA vs Google · {period} días
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DailyTrafficChart data={data.dailySeries} />
              </CardContent>
            </Card>
            <Card className="border-teal-500/20">
              <CardHeader>
                <CardTitle className="text-2xl">Origen del tráfico</CardTitle>
                <CardDescription>Referrers GA4</CardDescription>
              </CardHeader>
              <CardContent>
                <AiSourcesPanel sources={data.aiSources} totalSessions={kpis.totalSessions.value} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Top artículos</CardTitle>
                <CardDescription>Clicks + visitas</CardDescription>
              </CardHeader>
              <CardContent>
                <TopArticlesPanel articles={data.topArticles} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Publicaciones recientes</CardTitle>
                <CardDescription>Piezas de {TEO_AUTHOR_NAME}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentPublications.length ? (
                  data.recentPublications.map((pub) => {
                    const publicUrl = resolvePublicationUrl(pub.url, pub.slug);
                    return (
                      <div
                        key={pub.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-hub-border bg-[#07101f] px-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{pub.title}</p>
                          {pub.publishedAt ? (
                            <p className="mt-1 text-xs text-hub-muted">
                              {new Date(pub.publishedAt).toLocaleDateString('es-AR')}
                            </p>
                          ) : null}
                        </div>
                        {publicUrl ? (
                          <Button asChild size="sm" className="bg-cleexs-blue hover:bg-cleexs-blue-dark">
                            <a href={publicUrl} target="_blank" rel="noopener">
                              Abrir
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-hub-muted">Aún no hay publicaciones.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hub-border pt-5 text-xs text-hub-muted">
            <p>
              Fuente: Search Console
              {data.sources.ga4 ? ' + GA4' : ''} · Scoreboard Teo UI v3
            </p>
            <p>Actualizado: {formatUpdatedAt(data.updatedAt)}</p>
          </footer>
        </div>
      )}
    </CentroShell>
  );
}
