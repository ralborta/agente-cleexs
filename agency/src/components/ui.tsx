'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useStore } from '@/lib/store';

/* ------------------------------------------------------------------ */
/* Iconos (SVG stroke, estilo Stitch)                                  */
/* ------------------------------------------------------------------ */

const ICONS = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h6v6H4z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 3',
  link: 'M13.8 10.2a4 4 0 00-5.6 0l-4 4a4 4 0 105.6 5.6l1.1-1.1m-.8-4.9a4 4 0 005.6 0l4-4a4 4 0 00-5.6-5.6l-1.1 1.1',
  face: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  plus: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v8M8 12h8',
  add: 'M12 5v14M5 12h14',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8a9.9 9.9 0 01-4.3-.9L3 20l1.4-3.7C3.5 15 3 13.6 3 12c0-4.4 4-8 9-8s9 3.6 9 8z',
  tag: 'M7 7h.01M7 3h5a2 2 0 011.4.6l7 7a2 2 0 010 2.8l-7 7a2 2 0 01-2.8 0l-7-7A2 2 0 013 12V5a2 2 0 012-2z',
  user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  list: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  flag: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16v-4M12 8h.01',
  up: 'M7 17L17 7M17 7H7M17 7v10',
  chevronDown: 'M19 9l-7 7-7-7',
  chevronLeft: 'M15 19l-7-7 7-7',
  chevronRight: 'M9 5l7 7-7 7',
  search: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z',
  check: 'M5 13l4 4L19 7',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0',
  download: 'M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3M8 12l4 4 4-4M12 4v12',
  refresh: 'M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0019 13m-.6-4A8 8 0 005 11',
  x: 'M6 6l12 12M18 6L6 18',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3',
  warning: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20.4 15.4A9 9 0 118.6 3.6 9 9 0 0020.4 15.4z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  doc: 'M9 12h6m-6 4h6M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z',
  radar: 'M12 12l6-6M12 21a9 9 0 119-9M12 17a5 5 0 115-5M12 12h.01',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 3',
  play: 'M7 4l13 8-13 8z',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'w-4 h-4', strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Layout básico                                                       */
/* ------------------------------------------------------------------ */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`bg-surface rounded-2xl border border-line p-5 ${className}`}>{children}</article>;
}

export function CardTitle({ children, hint, right }: { children: ReactNode; hint?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-1.5 text-fg font-semibold text-sm">
        <span>{children}</span>
        {hint && (
          <span title={hint} className="text-dim cursor-help">
            <Icon name="info" className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  badge,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="max-w-3xl">
        {(eyebrow || badge) && (
          <div className="flex items-center gap-2 mb-1.5">
            {eyebrow && <span className="text-[10px] font-bold tracking-wider uppercase text-accent-cyan">{eyebrow}</span>}
            {badge}
          </div>
        )}
        <h1 className="text-xl font-bold text-fg tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-dim mt-1.5 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'cyan' | 'teal' | 'purple' | 'amber' | 'red' | 'green' | 'slate';
const TONES: Record<Tone, string> = {
  cyan: 'border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10',
  teal: 'border-accent-teal/40 text-accent-teal bg-accent-teal/10',
  purple: 'border-accent-purple/40 text-accent-purple bg-accent-purple/10',
  amber: 'border-accent-amber/40 text-accent-amber bg-accent-amber/10',
  red: 'border-red-500/40 text-red-400 bg-red-500/10',
  green: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  slate: 'border-line text-muted bg-surface2',
};

export function Pill({ children, tone = 'slate', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function ConfigBadge({ label = 'Config de proyecto · local' }: { label?: string }) {
  return <Pill tone="amber">{label}</Pill>;
}

export function EmptyState({
  title,
  body,
  icon = 'sparkle',
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6 border border-dashed border-line rounded-xl bg-surface2/50">
      <div className="w-9 h-9 rounded-full bg-surface border border-line flex items-center justify-center text-dim">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="text-fg font-medium text-sm">{title}</div>
      {body && <p className="text-dim text-xs max-w-md leading-relaxed">{body}</p>}
      {action}
    </div>
  );
}

export function ComingSoon({ what }: { what: string }) {
  return (
    <EmptyState
      icon="clock"
      title={`${what}: próximamente con datos Cleexs`}
      body="El backend de Cleexs todavía no expone esta información. No mostramos valores de ejemplo para no inventar métricas."
    />
  );
}

export function Notice({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'cyan' | 'red' }) {
  const cls =
    tone === 'amber'
      ? 'border-accent-amber/30 bg-accent-amber/5 text-accent-amber'
      : tone === 'red'
        ? 'border-red-500/30 bg-red-500/5 text-red-400'
        : 'border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan';
  return <div className={`rounded-xl border px-4 py-2.5 text-xs leading-relaxed mb-5 ${cls}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'cyan',
  sub,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'cyan' | 'teal' | 'purple' | 'amber' | 'fg';
  sub?: ReactNode;
}) {
  const color = { cyan: 'text-accent-cyan', teal: 'text-accent-teal', purple: 'text-accent-purple', amber: 'text-accent-amber', fg: 'text-fg' }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-muted text-xs font-medium">
        <span>{label}</span>
        {hint && (
          <span title={hint} className="text-dim cursor-help">
            <Icon name="info" className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className={`text-2xl font-extrabold tracking-tight mt-1.5 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-dim mt-1">{sub}</div>}
    </Card>
  );
}

/** Tabla con cabecera estilo Stitch */
type HeadCell = ReactNode | { label: ReactNode; right?: boolean };
export function Table({ head, children, className = '' }: { head: HeadCell[]; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] font-bold text-dim tracking-wider uppercase border-b border-line">
            {head.map((h, i) => {
              const o = typeof h === 'object' && h !== null && 'label' in h ? (h as { label: ReactNode; right?: boolean }) : { label: h as ReactNode, right: false };
              return (
                <th key={i} className={`pb-2.5 pr-3 font-semibold ${o.right ? 'text-right' : ''}`}>
                  {o.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            value === t.id
              ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
              : 'border-line bg-surface2 text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Botones y formularios                                               */
/* ------------------------------------------------------------------ */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName };
export function Btn({ children, icon, className = '', ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-cyan text-bg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition ${className}`}
    >
      {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}
export function GhostBtn({ children, icon, className = '', ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-line bg-surface text-muted hover:text-fg hover:border-dim disabled:opacity-40 disabled:cursor-not-allowed transition ${className}`}
    >
      {icon && <Icon name={icon} className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

const inputCls =
  'w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-xs text-fg placeholder:text-dim focus:outline-none focus:border-accent-cyan/60';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold tracking-wider uppercase text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputCls} resize-y ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

/* ------------------------------------------------------------------ */
/* Gráficos SVG                                                        */
/* ------------------------------------------------------------------ */

export type Series = { name: string; color: string; values: (number | null)[] };

export function LineChart({
  series,
  labels,
  height = 144,
  yMax,
  area = true,
  suffix = '%',
}: {
  series: Series[];
  labels: string[];
  height?: number;
  yMax?: number;
  area?: boolean;
  suffix?: string;
}) {
  const n = labels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (!n || !all.length) return null;
  const rawMax = yMax ?? Math.max(...all, 10);
  const max = yMax ?? (Math.ceil(rawMax / 10) * 10 || 10);
  const W = 500;
  const H = 120;
  const padL = 0;
  const x = (i: number) => (n === 1 ? W / 2 : padL + (i * (W - padL - 12)) / (n - 1));
  const y = (v: number) => H - (v / max) * (H - 6) - 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const gid = `g${series[0]?.color.replace('#', '')}`;

  const path = (s: Series) => {
    const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
    let d = '';
    let pen = false;
    pts.forEach((p) => {
      if (!p) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'} ${p[0].toFixed(1)},${p[1].toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  return (
    <div className="relative" style={{ paddingLeft: 34 }}>
      <div className="absolute left-0 top-0 flex flex-col justify-between text-[9px] text-dim" style={{ height }}>
        {[...ticks].reverse().map((t) => (
          <span key={t}>
            {t}
            {suffix}
          </span>
        ))}
      </div>
      <svg className="w-full overflow-visible" style={{ height }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : '3,3'} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {area && n > 1 && series[0] && (() => {
          const vals = series[0].values;
          const first = vals.findIndex((v) => v !== null);
          if (first < 0) return null;
          const d = path(series[0]);
          const lastIdx = vals.length - 1 - [...vals].reverse().findIndex((v) => v !== null);
          return <path d={`${d} L ${x(lastIdx)},${y(0)} L ${x(first)},${y(0)} Z`} fill={`url(#${gid})`} />;
        })()}
        {series.map((s, si) => (
          <g key={s.name}>
            {n > 1 && (
              <path
                d={path(s)}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 2 : 1.6}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className={si === 0 ? 'chart-glow' : undefined}
              />
            )}
          </g>
        ))}
      </svg>
      {/* puntos como HTML para que no se deformen */}
      <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ left: 34, height }}>
        {series.map((s) =>
          s.values.map((v, i) =>
            v === null ? null : (
              <span
                key={`${s.name}-${i}`}
                className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full"
                style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%`, background: s.color }}
                title={`${s.name}: ${v.toFixed(1).replace('.', ',')}${suffix}`}
              />
            ),
          ),
        )}
      </div>
      <div className="flex justify-between text-[10px] text-dim mt-1.5 px-1">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guardas de datos                                                    */
/* ------------------------------------------------------------------ */

/** Envuelve páginas que dependen del snapshot de Cleexs */
export function DataGate({ children }: { children: (d: NonNullable<ReturnType<typeof useStore>['data']>) => ReactNode }) {
  const { snapshot, data, isDefaultProject, projectName } = useStore();
  if (!isDefaultProject) {
    return (
      <EmptyState
        icon="link"
        title={`“${projectName}” es un proyecto local sin datos conectados`}
        body="Solo el proyecto principal está enlazado a la API de Cleexs. Cambiá de proyecto desde la barra lateral para ver métricas reales."
      />
    );
  }
  if (snapshot.loading && !snapshot.data) {
    return <div className="text-dim text-sm py-16 text-center animate-pulse">Cargando datos de Cleexs…</div>;
  }
  if (snapshot.error || !data) {
    return (
      <EmptyState
        icon="warning"
        title="No pudimos leer datos de Cleexs"
        body={snapshot.error ?? 'Respuesta vacía'}
      />
    );
  }
  return <>{children(data)}</>;
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-accent-cyan hover:underline">
      {children}
    </Link>
  );
}
