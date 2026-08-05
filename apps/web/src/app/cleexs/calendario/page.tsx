'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CentroShell } from '@/components/shell/centro-shell';
import {
  fetchContentCalendar,
  type CalendarItem,
  type CalendarKind,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const KIND_META: Record<
  CalendarKind,
  { label: string; className: string; dot: string }
> = {
  publicado: {
    label: 'Publicado',
    className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
    dot: 'bg-amber-400',
  },
  programado: {
    label: 'Listo / programado',
    className: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
    dot: 'bg-sky-400',
  },
  borrador: {
    label: 'Borrador',
    className: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    dot: 'bg-slate-400',
  },
};

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
}

/** Lunes = 0 … Domingo = 6 */
function mondayOffset(year: number, month: number): number {
  const js = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return js === 0 ? 6 : js - 1;
}

export default function CalendarioPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [byDay, setByDay] = useState<Record<string, CalendarItem[]>>({});
  const [counts, setCounts] = useState<Record<CalendarKind, number>>({
    publicado: 0,
    pendiente: 0,
    programado: 0,
    borrador: 0,
  });
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContentCalendar('cleexs', year, month);
      setByDay(data.byDay);
      setCounts(data.counts);
      setDaysInMonth(data.daysInMonth);
      setSelectedDay(null);
    } catch (err) {
      setByDay({});
      setError(err instanceof Error ? err.message : 'No se pudo cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const cells = useMemo(() => {
    const offset = mondayOffset(year, month);
    const total = offset + daysInMonth;
    const rows = Math.ceil(total / 7);
    const grid: Array<{ day: number | null }> = [];
    for (let i = 0; i < rows * 7; i += 1) {
      const day = i - offset + 1;
      grid.push({ day: day >= 1 && day <= daysInMonth ? day : null });
    }
    return grid;
  }, [year, month, daysInMonth]);

  const selectedItems =
    selectedDay != null ? byDay[String(selectedDay)] ?? [] : [];

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <CentroShell workspaceName="Cleexs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Calendario editorial</h2>
          <p className="mt-1 text-sm text-hub-muted">
            Vista mensual de lo publicado, pendiente de aprobación y listo para salir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-xl border border-hub-border bg-hub-card p-2 text-slate-300 hover:text-white"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-white">
            {monthLabel(year, month)}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-xl border border-hub-border bg-hub-card p-2 text-slate-300 hover:text-white"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as CalendarKind[]).map((k) => (
          <span
            key={k}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1',
              KIND_META[k].className,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', KIND_META[k].dot)} />
            {KIND_META[k].label}: {counts[k] ?? 0}
          </span>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-hub-muted">Cargando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-hub-border bg-hub-card shadow-hub">
            <div className="grid grid-cols-7 border-b border-hub-border bg-hub-bg/40">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-hub-muted"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
                const items = cell.day != null ? byDay[String(cell.day)] ?? [] : [];
                const isToday = isCurrentMonth && cell.day === today.getDate();
                const isSelected = cell.day != null && cell.day === selectedDay;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={cell.day == null}
                    onClick={() => cell.day != null && setSelectedDay(cell.day)}
                    className={cn(
                      'min-h-[88px] border-b border-r border-hub-border p-2 text-left transition',
                      cell.day == null && 'bg-hub-bg/20',
                      cell.day != null && 'hover:bg-white/5',
                      isSelected && 'bg-cleexs-blue/10 ring-1 ring-inset ring-cleexs-blue/40',
                      isToday && !isSelected && 'bg-white/[0.03]',
                    )}
                  >
                    {cell.day != null ? (
                      <>
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                            isToday
                              ? 'bg-cleexs-blue text-white'
                              : 'text-slate-300',
                          )}
                        >
                          {cell.day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {items.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-1 truncate text-[10px] text-slate-300"
                              title={item.title}
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  KIND_META[item.kind].dot,
                                )}
                              />
                              <span className="truncate">{item.title}</span>
                            </div>
                          ))}
                          {items.length > 3 ? (
                            <p className="text-[10px] text-hub-muted">+{items.length - 3}</p>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-hub-border bg-hub-card p-5 shadow-hub">
            <h3 className="text-sm font-semibold text-white">
              {selectedDay
                ? `Día ${selectedDay}`
                : 'Elegí un día'}
            </h3>
            <p className="mt-1 text-xs text-hub-muted">
              {selectedDay
                ? `${selectedItems.length} pieza(s)`
                : 'Click en una celda para ver el detalle.'}
            </p>

            <div className="mt-4 space-y-3">
              {selectedItems.length === 0 && selectedDay ? (
                <p className="text-sm text-hub-muted">Sin piezas este día.</p>
              ) : null}
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-hub-border bg-hub-bg/40 p-3"
                >
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                      KIND_META[item.kind].className,
                    )}
                  >
                    {KIND_META[item.kind].label}
                  </span>
                  <p className="mt-2 text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-hub-muted">
                    {item.type}
                    {item.cluster?.name ? ` · ${item.cluster.name}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.kind === 'pendiente' ? (
                      <Link
                        href="/cleexs/aprobaciones"
                        className="text-xs font-semibold text-cleexs-blue hover:underline"
                      >
                        Ir a aprobaciones
                      </Link>
                    ) : null}
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-cleexs-blue hover:underline"
                      >
                        Ver en WP
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </CentroShell>
  );
}
