'use client';

import { useCallback, useEffect, useState } from 'react';
import { CentroShell } from '@/components/shell/centro-shell';
import { createMission, fetchResults } from '@/lib/api-client';

export default function ResultadosPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchResults>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchResults('cleexs'));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const summary = data?.summary;

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Resultados</h2>
          <p className="mt-1 text-sm text-hub-muted">Métricas y publicaciones de Teo.</p>
        </div>
        <button
          type="button"
          onClick={triggerMission}
          disabled={running}
          className="rounded-xl bg-cleexs-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {running ? 'Ejecutando…' : 'Disparar misión Teo'}
        </button>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-cleexs-blue/30 bg-cleexs-blue/10 px-4 py-3 text-sm text-blue-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-hub-muted">Cargando…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Publicaciones', value: summary?.publications ?? 0 },
              { label: 'Misiones completadas', value: summary?.completedMissions ?? 0 },
              { label: 'En aprobación', value: summary?.pendingApprovals ?? 0 },
              { label: 'Impresiones GSC', value: summary?.totalImpressions ?? 0 },
              { label: 'Sesiones GA4', value: summary?.totalSessions ?? 0 },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub">
                <p className="text-xs uppercase tracking-wide text-hub-muted">{kpi.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub">
            <h3 className="text-lg font-semibold text-white">Publicaciones recientes</h3>
            {data?.recentPublications?.length ? (
              <ul className="mt-4 space-y-3">
                {data.recentPublications.map((pub) => (
                  <li key={pub.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-hub-border/50 pb-3">
                    <span className="text-sm text-white">{pub.piece.title}</span>
                    {pub.url ? (
                      <a href={pub.url} target="_blank" rel="noopener" className="text-sm text-cleexs-blue hover:underline">
                        Ver en WP
                      </a>
                    ) : (
                      <span className="text-xs text-hub-muted">Sin URL</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-hub-muted">Aún no hay publicaciones. Dispará una misión Teo.</p>
            )}
          </div>
        </>
      )}
    </CentroShell>
  );
}
