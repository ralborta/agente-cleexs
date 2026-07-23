import { StatusBadge } from '@/components/config/status-badge';
import type { AutomationStatus } from '@/lib/api-client';

export function AutomationPanel({ automation }: { automation: AutomationStatus | null }) {
  if (!automation) {
    return (
      <div className="rounded-2xl border border-hub-border bg-hub-card p-5 text-sm text-hub-muted">
        No se pudo cargar el estado de automatización.
      </div>
    );
  }

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

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Frecuencia efectiva</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            {automation.frequency ?? 'Sin definir'} · cada ~{automation.intervalDays} días
          </dd>
        </div>
        <div className="rounded-xl border border-hub-border/60 bg-[#0b1220]/40 px-4 py-3">
          <dt className="text-xs text-hub-muted">Publicación</dt>
          <dd className="mt-1 text-sm font-medium text-white">
            {automation.autoPublish ? 'Autopublicar (sin aprobación)' : 'Requiere aprobación humana'}
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

      {!automation.schedulerEnabled ? (
        <p className="mt-4 rounded-xl border border-cleexs-orange/20 bg-cleexs-orange/10 px-4 py-3 text-sm text-orange-100">
          El scheduler interno está pausado (`DISABLE_AUTONOMOUS=true`). Configurá temas acá y activalo
          en Easypanel para que Teo dispare misiones solo.
        </p>
      ) : null}
    </div>
  );
}
