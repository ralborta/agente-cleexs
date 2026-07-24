'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ActivityFeed } from '@/components/centro/activity-feed';
import { ContentEcosystemPanel } from '@/components/centro/content-ecosystem-panel';
import { RefreshAlertBanner } from '@/components/centro/refresh-alert-banner';
import { KpiGrid } from '@/components/centro/kpi-grid';
import { CentroShell } from '@/components/shell/centro-shell';
import { fetchCentroDashboard } from '@/lib/api-client';
import { PLATFORM_NAME, PLATFORM_SHORT, PLATFORM_TAGLINE } from '@/lib/branding';

type CentroData = Awaited<ReturnType<typeof fetchCentroDashboard>>;

const FALLBACK: CentroData = {
  workspace: { id: 'demo', name: 'Cleexs', slug: 'cleexs' },
  kpis: [
    { label: 'Piezas publicadas', value: 0, hint: 'Conectá la API' },
    { label: 'Impresiones Google', value: 0, hint: 'Search Console' },
    { label: 'En aprobación', value: 0, hint: 'Pendientes' },
    { label: 'A refrescar', value: 0, hint: 'Contenido viejo' },
    { label: 'Misiones activas', value: 0, hint: 'Teo trabajando' },
  ],
  agentsOnline: [{ slug: 'teo', name: 'Teo', status: 'online' }],
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
  const [data, setData] = useState<CentroData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCentroDashboard('cleexs'));
    } catch {
      setData(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onlineCount = data.agentsOnline.filter((a) => a.status !== 'idle').length;
  const pendingApprovals = data.kpis.find((k) => k.label === 'En aprobación')?.value ?? 0;

  const kpisWithLinks = data.kpis.map((kpi) => {
    if (kpi.label === 'En aprobación') return { ...kpi, href: '/cleexs/aprobaciones' };
    if (kpi.label === 'Misiones activas' || kpi.label === 'A refrescar') {
      return { ...kpi, href: '/cleexs/monitor' };
    }
    return kpi;
  });

  return (
    <CentroShell
      workspaceName={data.workspace.name}
      agentsOnline={onlineCount || 1}
      pendingApprovals={typeof pendingApprovals === 'number' ? pendingApprovals : 0}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cleexs-blue">
            {PLATFORM_NAME}
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-white">{PLATFORM_SHORT}</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">{PLATFORM_TAGLINE}</p>
        </div>
        <div className="rounded-full border border-cleexs-blue/30 bg-cleexs-blue/10 px-4 py-2 text-sm font-medium text-blue-200">
          {onlineCount || 1} agente{(onlineCount || 1) === 1 ? '' : 's'} en línea
        </div>
      </div>

      {!loading && typeof pendingApprovals === 'number' && pendingApprovals > 0 ? (
        <div className="mb-6 rounded-xl border border-cleexs-orange/30 bg-cleexs-orange/10 px-4 py-3 text-sm text-orange-100">
          Tenés {pendingApprovals} pieza{pendingApprovals === 1 ? '' : 's'} pendiente
          {pendingApprovals === 1 ? '' : 's'} de revisión.{' '}
          <Link href="/cleexs/aprobaciones" className="font-semibold text-white underline">
            Ir a Aprobaciones
          </Link>{' '}
          para preview, editar y publicar.
        </div>
      ) : null}

      {!loading ? (
        <RefreshAlertBanner pieces={data.contentRadar.pieces} onRetried={load} />
      ) : null}

      {loading ? (
        <p className="text-hub-muted">Cargando centro…</p>
      ) : (
        <>
          <KpiGrid items={kpisWithLinks} />
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <ContentEcosystemPanel data={data.contentRadar} />
            <ActivityFeed items={data.activity} />
          </div>
        </>
      )}
    </CentroShell>
  );
}
