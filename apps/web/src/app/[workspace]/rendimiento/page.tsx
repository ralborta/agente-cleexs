'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ExternalLink } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { MetricsKpiCard } from '@/components/metrics/metrics-kpi-card';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
        {label}: —
      </Badge>
    );
  }
  return (
    <Badge
      variant={ok ? 'success' : 'warning'}
      className="text-[10px] uppercase tracking-wide"
    >
      {label}: {ok ? 'ok' : 'error'}
    </Badge>
  );
}

export default function RendimientoPage() {
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [period, setPeriod] = useState<AnalyticsPeriod>(30);
  const [agent, setAgent] = useState<string>('teo');
  const [data, setData] = useState<PublicationPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await fetchPublicationPerformance(
          workspace,
          period,
          agent === 'all' ? null : agent,
        ),
      );
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspace, period, agent]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = data?.kpis;
  const agentTabs = data?.agents?.length
    ? data.agents
    : [{ slug: 'teo', name: 'Teo', publications: 0 }];

  return (
    <CentroShell workspaceName={workspaceName}>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.2),_transparent_55%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-7 md:px-8">
          <div>
            <Badge variant="info" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Por publicación · por agente
            </Badge>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Rendimiento
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-hub-muted md:text-base">
              Impresiones, clicks, visitas y CTAs de cada artículo. Filtrá por agente para medir el
              aporte de Teo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={agent} onValueChange={setAgent}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                {agentTabs.map((a) => (
                  <TabsTrigger key={a.slug} value={a.slug}>
                    {a.name}
                    {a.publications > 0 ? (
                      <span className="ml-1 opacity-70">({a.publications})</span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <MetricsPeriodTabs value={period} onChange={setPeriod} />
          </div>
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
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-white">No se pudieron cargar las métricas</p>
            <p className="mt-2 text-sm text-hub-muted">
              Verificá la API y las credenciales de Google en Integraciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-hub-muted">
            <Badge variant="outline">
              {[
                data.sources.gsc ? 'GSC' : null,
                data.sources.ga4 ? 'GA4' : null,
                data.sources.cta ? 'CTA' : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'sin datos externos'}
            </Badge>
            <span>Actualizado {new Date(data.updatedAt).toLocaleString('es-AR')}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricsKpiCard
              label="Publicaciones"
              value={kpis!.publications}
              hint="Artículos con URL publicada"
              accent="blue"
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
              accent="teal"
            />
            <MetricsKpiCard
              label="Visitas"
              value={kpis!.sessions}
              hint={`GA4 · últimos ${period} días`}
              accent="violet"
            />
            <MetricsKpiCard
              label="Eventos CTA"
              value={kpis!.ctaEvents}
              hint="Clicks + submits del bloque Cleexs"
              accent="orange"
            />
            <MetricsKpiCard
              label="Indexación OK"
              value={kpis!.indexedOk}
              hint="IndexNow o GSC submit ok"
            />
          </div>

          <Card className="animate-centro-in overflow-hidden">
            <CardHeader className="border-b border-hub-border">
              <CardTitle>Detalle por publicación</CardTitle>
              <CardDescription>
                Ordenado por score (clicks ×3 + visitas + CTAs).
              </CardDescription>
            </CardHeader>

            {!data.rows.length ? (
              <CardContent>
                <p className="py-10 text-center text-sm text-hub-muted">
                  No hay publicaciones{agent !== 'all' ? ` de ${agent}` : ''} todavía.
                </p>
              </CardContent>
            ) : (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0b1220]/80 hover:bg-[#0b1220]/80">
                      <TableHead className="px-5">Artículo</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Impresiones</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Visitas</TableHead>
                      <TableHead>CTA</TableHead>
                      <TableHead>Index</TableHead>
                      <TableHead className="px-5">Publicado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => {
                      const publicUrl = resolvePublicationUrl(row.url, row.slug);
                      return (
                        <TableRow key={row.publicationId}>
                          <TableCell className="max-w-[280px] px-5">
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
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{row.agentName}</Badge>
                          </TableCell>
                          <TableCell className="tabular-nums text-slate-200">
                            {formatMetric(row.impressions)}
                          </TableCell>
                          <TableCell className="tabular-nums text-slate-200">
                            {formatMetric(row.clicks)}
                          </TableCell>
                          <TableCell className="tabular-nums text-slate-200">{row.ctr}%</TableCell>
                          <TableCell className="tabular-nums text-slate-200">
                            {formatMetric(row.sessions)}
                          </TableCell>
                          <TableCell className="tabular-nums text-slate-200">
                            {formatMetric(row.ctaClicks + row.ctaSubmits)}
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell className="px-5 text-hub-muted">
                            {formatDate(row.publishedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          <p className={cn('text-xs text-hub-muted')}>
            Tip: las piezas nuevas pueden tardar días en acumular impresiones en Search Console.
            Revisá también{' '}
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href={workspaceHref(workspace, 'resultados')}>Resultados</Link>
            </Button>{' '}
            para el overview del blog.
          </p>
        </div>
      )}
    </CentroShell>
  );
}
