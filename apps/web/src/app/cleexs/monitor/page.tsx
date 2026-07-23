'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/config/status-badge';
import { buttonSecondaryClassName } from '@/components/config/settings-section';
import { CentroShell } from '@/components/shell/centro-shell';
import { createMission, fetchMissions, type Mission } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const STATUS_META: Record<string, { label: string; badge: 'ok' | 'warn' | 'error' | 'idle' }> = {
  pending: { label: 'Pendiente', badge: 'warn' },
  in_progress: { label: 'En curso', badge: 'ok' },
  completed: { label: 'Completada', badge: 'ok' },
  failed: { label: 'Fallida', badge: 'error' },
  cancelled: { label: 'Cancelada', badge: 'idle' },
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Autónoma',
  refresh_scan: 'Refresco',
};

export default function MonitorPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMissions('cleexs');
      setMissions(data.missions);
    } catch {
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function triggerMission() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await createMission('cleexs');
      setMessage(`Misión "${res.mission.title}" encolada…`);
      setTimeout(load, 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  const active = missions.filter((m) => ['pending', 'in_progress'].includes(m.status));

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cleexs-orange/30 bg-cleexs-orange/10 px-3 py-1 text-xs font-medium text-orange-200">
            <Radio className="h-3.5 w-3.5" />
            Operación
          </div>
          <h2 className="text-3xl font-semibold text-white">Misiones</h2>
          <p className="mt-2 text-sm text-hub-muted">
            Transparencia de lo que ejecuta Teo — autónomo o manual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className={buttonSecondaryClassName}>
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </span>
          </button>
          <button
            type="button"
            onClick={triggerMission}
            disabled={running}
            className="rounded-xl bg-cleexs-orange px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {running ? 'Encolando…' : 'Misión manual'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-cleexs-blue/30 bg-cleexs-blue/10 px-4 py-3 text-sm text-blue-200">
          {message}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub">
          <p className="text-xs uppercase tracking-wide text-hub-muted">Activas</p>
          <p className="mt-2 text-3xl font-semibold text-white">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub">
          <p className="text-xs uppercase tracking-wide text-hub-muted">Completadas (últimas 50)</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {missions.filter((m) => m.status === 'completed').length}
          </p>
        </div>
        <div className="rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub">
          <p className="text-xs uppercase tracking-wide text-hub-muted">Fallidas</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {missions.filter((m) => m.status === 'failed').length}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-hub-muted">Cargando misiones…</p>
      ) : missions.length === 0 ? (
        <div className="rounded-2xl border border-hub-border bg-hub-card p-8 text-center shadow-hub">
          <p className="text-white">Sin misiones todavía</p>
          <p className="mt-2 text-sm text-hub-muted">Dispará una manual o configurá temas para autonomía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((mission) => {
            const meta = STATUS_META[mission.status] ?? STATUS_META.pending;
            return (
              <article
                key={mission.id}
                className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={meta.badge} label={meta.label} />
                      <span className="rounded-full border border-hub-border px-2 py-0.5 text-xs text-hub-muted">
                        {TRIGGER_LABEL[mission.trigger] ?? mission.trigger}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{mission.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-hub-muted">{mission.objective}</p>
                  </div>
                  <div className="text-right text-xs text-hub-muted">
                    <p>{new Date(mission.createdAt).toLocaleString('es-AR')}</p>
                    <p className="mt-1">
                      {mission._count.pieces} pieza(s) · {mission._count.activities} eventos
                    </p>
                  </div>
                </div>

                {mission.steps.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {mission.steps.map((step) => (
                      <span
                        key={step.id}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-xs',
                          step.status === 'completed'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : step.status === 'failed'
                              ? 'border-red-500/30 bg-red-500/10 text-red-200'
                              : 'border-hub-border bg-[#0b1220]/50 text-hub-muted',
                        )}
                      >
                        {step.role} · {step.status}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </CentroShell>
  );
}
