'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import { PageHero } from '@/components/shell/page-hero';
import { FeaturedMetricCard } from '@/components/metrics/featured-metric-card';
import { MetricsPeriodTabs } from '@/components/metrics/metrics-period-tabs';
import { KpiGrid } from '@/components/centro/kpi-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
        {label}: —
      </Badge>
    );
  }
  return (
    <Badge variant={ok ? 'success' : 'warning'} className="text-[10px] uppercase tracking-wide">
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
        await fetchPublicationPerformance(workspace, period, agent === 'all' ? null : agent),
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
  const topRows = data?.rows.slice(0, 6) ?? [];

  return (
    <CentroShell workspaceName={workspaceName}>
      <PageHero
        kicker="Cleexs · Por artículo"
        title="Rendimiento"
        badge="UI v3"
        description="Cada artículo con impresiones, clicks, visitas y CTAs. Filtrá por agente."
        actions={
          <>
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
            <Button asChild variant="outline">
              <Link href={workspaceHref(workspace, 'resultados')}>Overview Resultados</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-hub-border bg-hub-card" />
            ))}
          </div>
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
        <div className="space-y-8">
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
              Totales del filtro
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <FeaturedMetricCard
                label="Impresiones"
                value={kpis!.impressions}
                hint={`GSC · ${period} días`}
                tone="blue"
              />
              <FeaturedMetricCard
                label="Clicks"
                value={kpis!.clicks}
                hint={`GSC · ${period} días`}
                tone="teal"
              />
              <FeaturedMetricCard
                label="Visitas"
                value={kpis!.sessions}
                hint={`GA4 · ${period} días`}
                tone="orange"
              />
            </div>
          </section>

          <KpiGrid
            items={[
              { label: 'Publicaciones', value: formatMetric(kpis!.publications) },
              { label: 'Eventos CTA', value: formatMetric(kpis!.ctaEvents) },
              { label: 'Indexación OK', value: formatMetric(kpis!.indexedOk) },
            ]}
          />

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
                  Top piezas
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">Cards de rendimiento</h3>
              </div>
              <Badge variant="outline">
                {[
                  data.sources.gsc ? 'GSC' : null,
                  data.sources.ga4 ? 'GA4' : null,
                  data.sources.cta ? 'CTA' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'sin fuentes'}
              </Badge>
            </div>

            {!topRows.length ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-hub-muted">
                  No hay publicaciones{agent !== 'all' ? ` de ${agent}` : ''} todavía.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {topRows.map((row, index) => {
                  const publicUrl = resolvePublicationUrl(row.url, row.slug);
                  return (
                    <Card
                      key={row.publicationId}
                      className="animate-centro-in transition hover:-translate-y-0.5 hover:border-cleexs-blue/45"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Badge variant="secondary">{row.agentName}</Badge>
                        </div>
                        <CardTitle className="mt-2 line-clamp-2 text-base">{row.title}</CardTitle>
                        <CardDescription>{formatDate(row.publishedAt)}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-hub-muted">Clicks</p>
                          <p className="text-xl font-semibold tabular-nums text-white">
                            {formatMetric(row.clicks)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-hub-muted">Visitas</p>
                          <p className="text-xl font-semibold tabular-nums text-white">
                            {formatMetric(row.sessions)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-hub-muted">Impr.</p>
                          <p className="text-lg font-semibold tabular-nums text-slate-200">
                            {formatMetric(row.impressions)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-hub-muted">CTR</p>
                          <p className="text-lg font-semibold tabular-nums text-slate-200">{row.ctr}%</p>
                        </div>
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          <StatusPill
                            label="GSC"
                            ok={
                              row.gscSubmitStatus == null ? null : row.gscSubmitStatus === 'ok'
                            }
                          />
                          <StatusPill
                            label="IN"
                            ok={row.indexNowStatus == null ? null : row.indexNowStatus === 'ok'}
                          />
                        </div>
                        {publicUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={publicUrl} target="_blank">
                              Ver <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        ) : null}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Card className="animate-centro-in overflow-hidden">
            <CardHeader className="border-b border-hub-border">
              <CardTitle>Tabla completa</CardTitle>
              <CardDescription>Todas las publicaciones del filtro actual.</CardDescription>
            </CardHeader>
            {!data.rows.length ? (
              <CardContent>
                <p className="py-8 text-center text-sm text-hub-muted">Sin filas.</p>
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
        </div>
      )}
    </CentroShell>
  );
}
