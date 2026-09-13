'use client';

import { useWorkspaceSlug } from '@/lib/workspace';
import { getStoredUser } from '@/lib/auth-client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/config/status-badge';
import { CentroShell } from '@/components/shell/centro-shell';
import { PageHero } from '@/components/shell/page-hero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createMission, fetchMissions, runRefresherScan, type Mission } from '@/lib/api-client';
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
  const workspace = useWorkspaceSlug();
  const workspaceName =
    getStoredUser()?.workspaceName || getStoredUser()?.workspaceSlug || 'Workspace';

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMissions(workspace);
      setMissions(data.missions);
    } catch {
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function triggerMission() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await createMission(workspace);
      setMessage(`Misión "${res.mission.title}" encolada…`);
      setTimeout(load, 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setRunning(false);
    }
  }

  async function triggerRefresherScan() {
    setScanning(true);
    setMessage(null);
    try {
      const res = await runRefresherScan(workspace, true);
      if (res.candidates === 0) {
        setMessage(`Refrescador: ${res.scanned} URL(s) analizadas — sin candidatos urgentes`);
      } else if (res.mission?.skipped) {
        setMessage(
          `${res.candidates} candidato(s). Prioridad: "${res.topCandidate?.title}" — misión no encolada (${res.mission.reason})`,
        );
      } else if (res.mission?.missionId) {
        setMessage(
          `Refrescador: misión encolada para "${res.topCandidate?.title}" — ${res.topCandidate?.reason}`,
        );
        setTimeout(load, 2000);
      } else {
        setMessage(
          `${res.candidates} candidato(s) marcados. Prioridad: "${res.topCandidate?.title}" — ${res.topCandidate?.reason}`,
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error en escaneo');
    } finally {
      setScanning(false);
    }
  }

  const active = missions.filter((m) => ['pending', 'in_progress'].includes(m.status));

  return (
    <CentroShell workspaceName={workspaceName}>
      <PageHero
        kicker="Cleexs · Operación"
        title="Monitor"
        badge="UI v3"
        description="Misiones de Teo, escaneo refrescador y transparencia operativa."
        actions={
          <>
            <Button type="button" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4" /> Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={triggerRefresherScan}
              disabled={scanning || running}
            >
              {scanning ? 'Escaneando…' : 'Escaneo refrescador'}
            </Button>
            <Button
              type="button"
              onClick={triggerMission}
              disabled={running || scanning}
              className="bg-cleexs-orange hover:bg-cleexs-orange/90"
            >
              {running ? 'Encolando…' : 'Misión manual'}
            </Button>
          </>
        }
      />

      {message ? (
        <Card className="mb-4 border-cleexs-blue/30 bg-cleexs-blue/10">
          <CardContent className="p-4 text-sm text-blue-200">{message}</CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-hub-muted">Activas</p>
            <p className="mt-2 text-3xl font-semibold text-white">{active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-hub-muted">Completadas (últimas 50)</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {missions.filter((m) => m.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-hub-muted">Fallidas</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {missions.filter((m) => m.status === 'failed').length}
            </p>
          </CardContent>
        </Card>
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
