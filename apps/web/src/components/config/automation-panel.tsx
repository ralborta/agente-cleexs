'use client';

import { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/config/status-badge';
import { buttonSecondaryClassName } from '@/components/config/settings-section';
import { triggerSchedulerTick, type AutomationStatus } from '@/lib/api-client';

type Props = {
  automation: AutomationStatus | null;
  onTickComplete?: () => void;
};

export function AutomationPanel({ automation, onTickComplete }: Props) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!automation) {
    return (
      <div className="rounded-2xl border border-hub-border bg-hub-card p-5 text-sm text-hub-muted">
        No se pudo cargar el estado de automatización.
      </div>
    );
  }

  async function runTickNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await triggerSchedulerTick('cleexs');
      const parts: string[] = [];
      if ((res.result.opportunities?.created ?? 0) > 0) {
        parts.push(`+${res.result.opportunities!.created} oportunidad(es)`);
      }
      if ((res.result.demand?.scored ?? 0) > 0 || (res.result.demand?.imported ?? 0) > 0) {
        parts.push(
          `demanda GSC (score ${res.result.demand!.scored}, +${res.result.demand!.imported})`,
        );
      }
      if ((res.result.questions?.created ?? 0) > 0) {
        parts.push(`+${res.result.questions!.created} pregunta(s)`);
      }
      if (res.result.missions.spawned > 0) {
        parts.push(`${res.result.missions.spawned} misión(es) autónoma(s)`);
      }
      if (res.result.metrics.synced > 0) {
        parts.push(`métricas sync (${res.result.metrics.synced} ws)`);
      }
      if (res.result.refresher.missionsSpawned > 0) {
        parts.push(`${res.result.refresher.missionsSpawned} refresco(s)`);
      }
      setMessage(parts.length > 0 ? `Tick OK: ${parts.join(' · ')}` : 'Tick OK — sin acciones pendientes');
      onTickComplete?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al ejecutar tick');
    } finally {
      setRunning(false);
    }
  }

  const nextLabel = automation.eligibleForNext
    ? 'Ahora — listo para encolar'
    : automation.nextEligibleAt
      ? new Date(automation.nextEligibleAt).toLocaleString('es-AR')
      : '—';

  return (
    <div className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-hub-muted">
            Automatización
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">Teo en modo autónomo</h3>
        </div>
        <StatusBadge
          status={automation.schedulerEnabled ? (automation.eligibleForNext ? 'ok' : 'warn') : 'idle'}
          label={
            automation.schedulerEnabled
              ? automation.eligibleForNext
                ? 'Listo para próxima misión'
                : 'Scheduler activo'
              : 'Scheduler pausado'
          }
        />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Frecuencia efectiva</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            {automation.frequency ?? 'Sin definir'} · cada ~{automation.intervalDays} días
          </dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Próxima misión autónoma</dt>
          <dd className="mt-1 text-sm font-medium text-white">{nextLabel}</dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Tick interno</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            cada {Math.round(automation.tickIntervalMs / 60000)} min
          </dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Publicación</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            {automation.autoPublish ? 'Autopublicar' : 'Requiere aprobación'}
          </dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Misiones activas</dt>
          <dd className="mt-1 text-sm font-medium text-white">{automation.activeMissions}</dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Último sync métricas</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            {automation.lastMetricsSync
              ? new Date(automation.lastMetricsSync).toLocaleString('es-AR')
              : 'Nunca'}
          </dd>
        </div>
      </dl>

      {automation.lastMission ? (
        <p className="mt-4 text-sm text-hub-muted">
          Última misión:{' '}
          <span className="text-slate-200">{automation.lastMission.title}</span> ·{' '}
          {automation.lastMission.status} ·{' '}
          {new Date(automation.lastMission.createdAt).toLocaleString('es-AR')}
        </p>
      ) : null}

      {automation.schedulerEnabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runTickNow}
            disabled={running}
            className={buttonSecondaryClassName}
          >
            <span className="inline-flex items-center gap-2">
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? 'Ejecutando tick…' : 'Ejecutar tick ahora'}
            </span>
          </button>
          {message ? <span className="text-sm text-emerald-200">{message}</span> : null}
        </div>
      ) : null}

      {!automation.schedulerEnabled ? (
        <p className="mt-4 rounded-xl border border-cleexs-orange/20 bg-cleexs-orange/10 px-4 py-3 text-sm text-orange-100">
          Scheduler pausado (`DISABLE_AUTONOMOUS=true`). Cambiá la variable en Easypanel API y redeploy.
        </p>
      ) : (
        <div className="mt-4 space-y-2 rounded-xl border border-hub-border bg-[#0b1220]/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-hub-muted">
            Cron de respaldo (opcional)
          </p>
          <p className="text-xs text-hub-muted">
            El scheduler interno ya corre cada hora. Si reiniciás la API, un cron externo garantiza que no
            se pierda un ciclo.
          </p>
          <CronLine label="Tick autónomo (cada hora)" url={automation.cronBackup?.autonomousTick} />
          <CronLine
            label="Sync métricas (diario 6:00)"
            url={automation.cronBackup?.metricsSync}
            body='{"workspace":"cleexs"}'
          />
          <p className="text-[11px] text-hub-muted">
            Header: <code className="rounded bg-black/30 px-1">{automation.cronBackup?.header}</code> = valor
            de <code className="rounded bg-black/30 px-1">CRON_SECRET</code> en Easypanel
          </p>
        </div>
      )}
    </div>
  );
}

function CronLine({
  label,
  url,
  body,
}: {
  label: string;
  url?: string;
  body?: string;
}) {
  if (!url) return null;
  const cmd = body
    ? `curl -sS -X POST "${url}" -H "x-cron-secret: TU_SECRET" -H "Content-Type: application/json" -d '${body}'`
    : `curl -sS -X POST "${url}" -H "x-cron-secret: TU_SECRET"`;
  return (
    <div className="mt-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <code className="mt-1 block overflow-x-auto rounded bg-black/40 p-2 text-[10px] text-slate-300">
        {cmd}
      </code>
    </div>
  );
}
