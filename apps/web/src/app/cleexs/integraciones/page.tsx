'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plug, RefreshCw, TestTube2 } from 'lucide-react';
import { AutomationPanel } from '@/components/config/automation-panel';
import { StatusBadge } from '@/components/config/status-badge';
import {
  SettingsSection,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
} from '@/components/config/settings-section';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  fetchIntegrationsOverview,
  syncMetrics,
  testGoogleIntegration,
  testWordPressIntegration,
  type IntegrationsOverview,
} from '@/lib/api-client';

function integrationBadge(configured: boolean, connected?: boolean) {
  if (!configured) return { status: 'idle' as const, label: 'No configurado' };
  if (connected) return { status: 'ok' as const, label: 'Conectado' };
  return { status: 'error' as const, label: 'Error' };
}

export default function IntegracionesPage() {
  const [data, setData] = useState<IntegrationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchIntegrationsOverview('cleexs'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runTest(kind: 'wp' | 'google' | 'sync') {
    setTesting(kind);
    setMessage(null);
    setError(null);
    try {
      if (kind === 'wp') {
        const res = await testWordPressIntegration('cleexs');
        setMessage(
          res.wordpress.ok
            ? `WordPress OK — usuario ${res.wordpress.user ?? 'Teo'}`
            : 'WordPress respondió con error',
        );
      } else if (kind === 'google') {
        const res = await testGoogleIntegration('cleexs');
        setMessage(
          res.google.connected
            ? 'Google OK — Search Console y GA4 responden'
            : res.google.error ?? 'Google respondió con error',
        );
      } else {
        const res = await syncMetrics('cleexs');
        setMessage(
          res.ok
            ? `Métricas sincronizadas (${res.snapshotsWritten ?? 0} snapshots)`
            : res.message ?? 'Sync completado',
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en la operación');
    } finally {
      setTesting(null);
    }
  }

  const wpBadge = data
    ? integrationBadge(data.wordpress.configured, data.wordpress.connected ?? data.wordpress.configured)
    : null;
  const googleBadge = data
    ? integrationBadge(data.google.configured, Boolean(data.google.gscSiteUrl && data.google.ga4PropertyId))
    : null;

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-hub-border bg-hub-card px-3 py-1 text-xs font-medium text-hub-muted">
            <Plug className="h-3.5 w-3.5" />
            Conexiones
          </div>
          <h2 className="text-3xl font-semibold text-white">Integraciones</h2>
          <p className="mt-2 max-w-2xl text-sm text-hub-muted">
            Estado de WordPress, Google Search Console y Analytics. Las credenciales viven en Easypanel; acá
            ves si todo responde.
          </p>
        </div>
        <button type="button" onClick={load} className={buttonSecondaryClassName}>
          Recargar
        </button>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <p className="text-hub-muted">Cargando integraciones…</p>
      ) : (
        <div className="space-y-6">
          <AutomationPanel automation={data.automation} />

          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsSection title="WordPress" description="Publicación en cleexs.net/articulos/">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {wpBadge ? <StatusBadge status={wpBadge.status} label={wpBadge.label} /> : null}
                <button
                  type="button"
                  onClick={() => runTest('wp')}
                  disabled={testing !== null}
                  className={buttonSecondaryClassName}
                >
                  <span className="inline-flex items-center gap-2">
                    <TestTube2 className="h-4 w-4" />
                    {testing === 'wp' ? 'Probando…' : 'Probar'}
                  </span>
                </button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-hub-muted">Sitio</dt>
                  <dd className="text-slate-200">{data.wordpress.site ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hub-muted">Usuario</dt>
                  <dd className="text-slate-200">{data.wordpress.user ?? '—'}</dd>
                </div>
              </dl>
            </SettingsSection>

            <SettingsSection title="Google (GSC + GA4)" description="Métricas para Resultados">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {googleBadge ? <StatusBadge status={googleBadge.status} label={googleBadge.label} /> : null}
                <button
                  type="button"
                  onClick={() => runTest('google')}
                  disabled={testing !== null}
                  className={buttonSecondaryClassName}
                >
                  <span className="inline-flex items-center gap-2">
                    <TestTube2 className="h-4 w-4" />
                    {testing === 'google' ? 'Probando…' : 'Probar'}
                  </span>
                </button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-hub-muted">Search Console</dt>
                  <dd className="truncate text-slate-200">{data.google.gscSiteUrl ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hub-muted">GA4 Property</dt>
                  <dd className="text-slate-200">{data.google.ga4PropertyId ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hub-muted">Service account</dt>
                  <dd className="truncate text-right text-xs text-slate-300">
                    {data.google.serviceAccountEmail ?? '—'}
                  </dd>
                </div>
              </dl>
            </SettingsSection>
          </div>

          <SettingsSection
            title="Sync de métricas"
            description="Actualiza clicks, impresiones y sesiones por artículo en la base de datos."
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-hub-muted">
                Último sync:{' '}
                <span className="text-slate-200">
                  {data.automation.lastMetricsSync
                    ? new Date(data.automation.lastMetricsSync).toLocaleString('es-AR')
                    : 'Nunca'}
                </span>
              </p>
              <button
                type="button"
                onClick={() => runTest('sync')}
                disabled={testing !== null}
                className={buttonPrimaryClassName}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${testing === 'sync' ? 'animate-spin' : ''}`} />
                  {testing === 'sync' ? 'Sincronizando…' : 'Sync ahora'}
                </span>
              </button>
            </div>
            <p className="mt-4 text-xs text-hub-muted">
              Recomendado: cron diario en Easypanel apuntando a{' '}
              <code className="rounded bg-[#0b1220] px-1.5 py-0.5">POST /api/cron/metrics-sync</code>
            </p>
          </SettingsSection>
        </div>
      )}
    </CentroShell>
  );
}
