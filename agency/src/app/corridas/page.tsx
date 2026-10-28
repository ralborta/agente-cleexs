'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardTitle,
  ConfigBadge,
  Field,
  Notice,
  PageHeader,
  Pill,
  Select,
  TextArea,
  TextInput,
  Btn,
  Icon,
} from '@/components/ui';
import { useStore, type RunScheduleCfg } from '@/lib/store';

const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
];

const TIMEZONES = [
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Sao_Paulo',
  'UTC',
];

const CADENCES: RunScheduleCfg['cadence'][] = ['Diaria', 'Semanal', 'Quincenal', 'Mensual', 'Una vez'];

function summarize(s: RunScheduleCfg): string {
  if (!s.enabled) return 'Programación pausada en Cleexs';
  const hora = s.time || '—';
  if (s.cadence === 'Diaria') return `Preferencia diaria a las ${hora} (${s.timezone}) · Cleexs cron: semanal`;
  if (s.cadence === 'Semanal') {
    const days = WEEKDAYS.filter((d) => s.weekdays.includes(d.value)).map((d) => d.label);
    return `${days.join(', ') || 'sin días'} a las ${hora} (${s.timezone}) · Cleexs: semanal`;
  }
  if (s.cadence === 'Quincenal') return `Cada 15 días a las ${hora} (${s.timezone}) · Cleexs: quincenal`;
  if (s.cadence === 'Mensual') return `Día ${s.dayOfMonth} de cada mes a las ${hora} (${s.timezone}) · Cleexs: mensual`;
  return s.date ? `Una vez el ${s.date} a las ${hora} · sin cron Cleexs (usar Ejecutar ahora)` : `Una vez · falta fecha`;
}

type RunNowResult = {
  mode: string;
  results?: Array<{
    title?: string;
    responseText?: string;
    analysis?: unknown;
    executionId?: string;
  }>;
  runId?: string;
};

export default function Page() {
  const { config, updateConfig, projectName } = useStore();
  const s = config.schedule;
  const set = (patch: Partial<RunScheduleCfg>) => updateConfig({ schedule: { ...s, ...patch } });
  const customActive = (config.customPrompts ?? []).filter((p) => p.active && p.text.trim()).length;

  const [cleexsSchedule, setCleexsSchedule] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunNowResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cleexs/schedule', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error);
        setCleexsSchedule(data.runSchedule);
        if (data.runSchedule === 'mensual') set({ enabled: true, cadence: 'Mensual' });
        else if (data.runSchedule === 'quincenal') set({ enabled: true, cadence: 'Quincenal' });
        else if (data.runSchedule === 'semanal') set({ enabled: true, cadence: 'Semanal' });
        else if (data.runSchedule == null) set({ enabled: false });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDay = (day: number) => {
    const has = s.weekdays.includes(day);
    const weekdays = has ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day].sort((a, b) => a - b);
    set({ weekdays });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      updateConfig({ schedule: { ...s } });
      const res = await fetch('/api/cleexs/schedule', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: s.enabled, cadence: s.cadence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al guardar');
      setCleexsSchedule(data.runSchedule);
      setOkMsg(
        data.runSchedule
          ? `Guardado en Cleexs: ${data.runSchedule}`
          : 'Programación Cleexs pausada (sin cron).',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    setOkMsg(null);
    setRunResult(null);
    try {
      const res = await fetch('/api/cleexs/run-now', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customOnly: customActive > 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Error al ejecutar');
      setRunResult(data);
      setOkMsg(
        data.mode === 'custom'
          ? `Medidos ${data.count} prompts propios en Cleexs (IA real).`
          : `Corrida Cleexs disparada (${data.mode}${data.runId ? ` · ${data.runId}` : ''}).`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Setup · Corridas"
        title="Configuración de corridas"
        badge={<ConfigBadge label="Cleexs · hora · día · fecha" />}
        subtitle={`Definí cuándo Cleexs debe medir a ${projectName}. La frecuencia se guarda en Cleexs; hora/día orientan al especialista y al cron.`}
      />

      {error && <Notice tone="red">{error}</Notice>}
      {okMsg && <Notice tone="cyan">{okMsg}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <Card className="lg:col-span-2">
          <CardTitle
            right={
              <Pill tone={s.enabled ? 'green' : 'slate'}>
                {s.enabled ? 'Activa' : 'Pausada'}
                {cleexsSchedule ? ` · Cleexs:${cleexsSchedule}` : ''}
              </Pill>
            }
          >
            Programación
          </CardTitle>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-line accent-cyan-500"
            />
            <span className="text-sm text-fg">Activar corridas programadas en Cleexs</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cadencia">
              <Select
                value={s.cadence}
                onChange={(e) => set({ cadence: e.target.value as RunScheduleCfg['cadence'] })}
                disabled={!s.enabled}
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Hora" hint="Formato 24 h (referencia operativa)">
              <TextInput
                type="time"
                value={s.time}
                onChange={(e) => set({ time: e.target.value })}
                disabled={!s.enabled}
              />
            </Field>

            <Field label="Zona horaria">
              <Select value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} disabled={!s.enabled}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>

            {s.cadence === 'Mensual' && (
              <Field label="Día del mes" hint="1–28 recomendado">
                <TextInput
                  type="number"
                  min={1}
                  max={28}
                  value={String(s.dayOfMonth)}
                  onChange={(e) => set({ dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
                  disabled={!s.enabled}
                />
              </Field>
            )}

            {s.cadence === 'Una vez' && (
              <Field label="Fecha">
                <TextInput type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} disabled={!s.enabled} />
              </Field>
            )}
          </div>

          {s.cadence === 'Semanal' && (
            <div className="mt-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Días de la semana</div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = s.weekdays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      disabled={!s.enabled}
                      onClick={() => toggleDay(d.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        on
                          ? 'border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan'
                          : 'border-line bg-surface2 text-muted hover:text-fg'
                      } disabled:opacity-40`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5">
            <Field label="Notas (opcional)">
              <TextArea
                rows={3}
                value={s.notes}
                placeholder="Ej. Corrida semanal de Empliados antes del reporte al cliente"
                onChange={(e) => set({ notes: e.target.value })}
                disabled={!s.enabled}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Btn type="button" onClick={save} disabled={saving || running}>
              <Icon name="check" className="w-3.5 h-3.5" />
              {saving ? 'Guardando…' : 'Guardar en Cleexs'}
            </Btn>
            <Btn type="button" onClick={runNow} disabled={running || saving}>
              <Icon name="sparkle" className="w-3.5 h-3.5" />
              {running ? 'Midiendo…' : 'Ejecutar ahora'}
            </Btn>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle>Resumen</CardTitle>
            <p className="text-sm text-fg leading-relaxed">{summarize(s)}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-line/70 py-2">
                <span className="text-dim">Cleexs runSchedule</span>
                <span className="text-fg">{cleexsSchedule ?? '—'}</span>
              </div>
              <div className="flex justify-between border-b border-line/70 py-2">
                <span className="text-dim">Cadencia UI</span>
                <span className="text-fg">{s.cadence}</span>
              </div>
              <div className="flex justify-between border-b border-line/70 py-2">
                <span className="text-dim">Hora</span>
                <span className="text-fg">{s.time || '—'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-dim">Prompts propios activos</span>
                <span className="text-fg">{customActive}</span>
              </div>
            </div>
          </Card>

          <Notice tone="cyan">
            Guardar escribe la frecuencia en Cleexs (semanal / quincenal / mensual). Ejecutar ahora mide con IA real los
            prompts propios (o dispara una corrida Cleexs si no hay propios).
          </Notice>
        </div>
      </div>

      {runResult?.results && runResult.results.length > 0 && (
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-semibold text-fg">Resultados de esta ejecución</h3>
          {runResult.results.map((r, i) => (
            <Card key={r.executionId || i} className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-accent-teal mb-2">
                {r.title || `Prompt ${i + 1}`}
              </div>
              {typeof r.analysis === 'object' &&
              r.analysis !== null &&
              'resumen' in r.analysis &&
              typeof (r.analysis as { resumen?: unknown }).resumen === 'string' ? (
                <p className="text-sm text-fg mb-2">{(r.analysis as { resumen: string }).resumen}</p>
              ) : null}
              <div className="text-xs text-muted whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {r.responseText}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
