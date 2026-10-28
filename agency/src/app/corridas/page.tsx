'use client';

import { Card, CardTitle, ConfigBadge, Field, Notice, PageHeader, Pill, Select, TextArea, TextInput, Btn, Icon } from '@/components/ui';
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

function summarize(s: RunScheduleCfg): string {
  if (!s.enabled) return 'Programación pausada';
  const hora = s.time || '—';
  if (s.cadence === 'Diaria') return `Todos los días a las ${hora} (${s.timezone})`;
  if (s.cadence === 'Semanal') {
    const days = WEEKDAYS.filter((d) => s.weekdays.includes(d.value)).map((d) => d.label);
    return `${days.join(', ') || 'sin días'} a las ${hora} (${s.timezone})`;
  }
  if (s.cadence === 'Mensual') return `Día ${s.dayOfMonth} de cada mes a las ${hora} (${s.timezone})`;
  return s.date ? `Una vez el ${s.date} a las ${hora} (${s.timezone})` : `Una vez · falta fecha · ${hora}`;
}

export default function Page() {
  const { config, updateConfig, projectName, config: cfg } = useStore();
  const s = config.schedule;
  const set = (patch: Partial<RunScheduleCfg>) => updateConfig({ schedule: { ...s, ...patch } });
  const customActive = (cfg.customPrompts ?? []).filter((p) => p.active).length;

  const toggleDay = (day: number) => {
    const has = s.weekdays.includes(day);
    const weekdays = has ? s.weekdays.filter((d) => d !== day) : [...s.weekdays, day].sort((a, b) => a - b);
    set({ weekdays });
  };

  return (
    <>
      <PageHeader
        eyebrow="Registro · Corridas"
        title="Configuración de corridas"
        badge={<ConfigBadge label="hora · día · fecha" />}
        subtitle={`Definí cuándo Cleexs Agency debe medir a ${projectName}: por hora, día de la semana, día del mes o una fecha puntual.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <Card className="lg:col-span-2">
          <CardTitle right={<Pill tone={s.enabled ? 'green' : 'slate'}>{s.enabled ? 'Activa' : 'Pausada'}</Pill>}>
            Programación
          </CardTitle>

          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-line accent-cyan-500"
            />
            <span className="text-sm text-fg">Activar corridas programadas</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cadencia">
              <Select
                value={s.cadence}
                onChange={(e) => set({ cadence: e.target.value as RunScheduleCfg['cadence'] })}
                disabled={!s.enabled}
              >
                {(['Diaria', 'Semanal', 'Mensual', 'Una vez'] as const).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Hora" hint="Formato 24 h">
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

          <div className="mt-4 flex items-center gap-2">
            <Btn type="button" onClick={() => updateConfig({ schedule: { ...s } })}>
              <Icon name="check" className="w-3.5 h-3.5" /> Guardar programación
            </Btn>
            <span className="text-[11px] text-dim">Se guarda en este navegador / proyecto</span>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle>Resumen</CardTitle>
            <p className="text-sm text-fg leading-relaxed">{summarize(s)}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-line/70 py-2">
                <span className="text-dim">Estado</span>
                <span className="text-fg">{s.enabled ? 'Activa' : 'Pausada'}</span>
              </div>
              <div className="flex justify-between border-b border-line/70 py-2">
                <span className="text-dim">Cadencia</span>
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
            Esta pantalla define cuándo medir. Los prompts propios (hasta 3) se cargan en Prompts. La ejecución
            automática en Cleexs se conecta con esta programación en el siguiente paso operativo.
          </Notice>
        </div>
      </div>
    </>
  );
}
