'use client';

import { useWorkspaceSlug, workspaceHref } from '@/lib/workspace';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '@/components/centro/activity-feed';
import { AgentRoster } from '@/components/centro/agent-roster';
import { ContentEcosystemPanel } from '@/components/centro/content-ecosystem-panel';
import { RefreshAlertBanner } from '@/components/centro/refresh-alert-banner';
import { KpiGrid } from '@/components/centro/kpi-grid';
import { CentroShell } from '@/components/shell/centro-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchCentroDashboard } from '@/lib/api-client';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/branding';

type CentroData = Awaited<ReturnType<typeof fetchCentroDashboard>>;

const FALLBACK: CentroData = {
  workspace: { id: 'demo', name: 'Workspace', slug: 'cleexs' },
  kpis: [
    { label: 'Piezas publicadas', value: 0, hint: 'Conectá la API' },
    { label: 'Impresiones Google', value: 0, hint: 'Search Console' },
    { label: 'En aprobación', value: 0, hint: 'Pendientes' },
    { label: 'A refrescar', value: 0, hint: 'Contenido viejo' },
    { label: 'Misiones activas', value: 0, hint: 'Teo trabajando' },
  ],
  agentsOnline: [
    { slug: 'teo', name: 'Teo', status: 'online' },
    { slug: 'discovery', name: 'Discovery', status: 'online' },
    { slug: 'growth', name: 'Growth', status: 'online' },
  ],
  activity: [],
  contentRadar: {
    agentName: 'Teo',
    agentActive: true,
    agentWorking: false,
    pieces: [],
    stats: { active: 0, published: 0, approval: 0, working: 0, refresh: 0 },
  },
};

export default function CleexsCentroPage() {
  const workspace = useWorkspaceSlug();

  const [data, setData] = useState<CentroData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCentroDashboard(workspace));
    } catch {
      setData(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  const onlineCount = data.agentsOnline.filter((a) => a.status !== 'idle').length;
  const pendingApprovals = data.kpis.find((k) => k.label === 'En aprobación')?.value ?? 0;
  const publishedCount = data.kpis.find((k) => k.label === 'Piezas publicadas')?.value ?? 0;

  const kpisWithLinks = data.kpis.map((kpi) => {
    if (kpi.label === 'En aprobación') return { ...kpi, href: workspaceHref(workspace, 'aprobaciones') };
    if (kpi.label === 'Misiones activas' || kpi.label === 'A refrescar') {
      return { ...kpi, href: workspaceHref(workspace, 'monitor') };
    }
    return kpi;
  });

  const rosterAgents = useMemo(() => {
    const fromApi = data.agentsOnline;
    const defaults = [
      { slug: 'teo', name: 'Teo', status: 'online' },
      { slug: 'discovery', name: 'Discovery', status: 'online' },
      { slug: 'growth', name: 'Growth', status: 'online' },
    ];
    return defaults.map((d) => fromApi.find((a) => a.slug === d.slug) || d);
  }, [data.agentsOnline]);

  return (
    <CentroShell
      workspaceName={data.workspace.name}
      agentsOnline={onlineCount || 3}
      pendingApprovals={typeof pendingApprovals === 'number' ? pendingApprovals : 0}
    >
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(37,99,235,0.22),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,_transparent_40%,_rgba(15,23,42,0.65))]" />
        <div className="relative px-6 py-7 md:px-8">
          <p className="text-sm font-semibold tracking-[0.2em] text-cleexs-blue">CLEEXS</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {PLATFORM_NAME}
          </h2>
          <p className="mt-3 max-w-xl text-sm text-hub-muted md:text-base">{PLATFORM_TAGLINE}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={workspaceHref(workspace, 'resultados')}>Nueva misión Teo</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={workspaceHref(workspace, 'discovery')}>Ver Discovery</Link>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-hub-muted">Cargando centro…</p>
      ) : (
        <div className="space-y-6">
          <AgentRoster
            workspace={workspace}
            agents={rosterAgents}
            teoWorking={data.contentRadar.agentWorking}
            publishedCount={typeof publishedCount === 'number' ? publishedCount : 0}
            pendingApprovals={typeof pendingApprovals === 'number' ? pendingApprovals : 0}
          />

          {typeof pendingApprovals === 'number' && pendingApprovals > 0 ? (
            <Card className="border-cleexs-orange/30 bg-cleexs-orange/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-orange-100">
                <p>
                  Tenés {pendingApprovals} pieza{pendingApprovals === 1 ? '' : 's'} pendiente
                  {pendingApprovals === 1 ? '' : 's'} de revisión.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={workspaceHref(workspace, 'aprobaciones')}>Ir a Aprobaciones</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <RefreshAlertBanner pieces={data.contentRadar.pieces} onRetried={load} />

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-hub-muted">
              Señales del workspace
            </p>
            <KpiGrid items={kpisWithLinks} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <ContentEcosystemPanel data={data.contentRadar} />
            <ActivityFeed items={data.activity} />
          </div>
        </div>
      )}
    </CentroShell>
  );
}
