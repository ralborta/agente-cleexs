import { cn } from '@/lib/utils';
import { formatMetric } from '@/lib/analytics-types';

type Props = {
  label: string;
  value: number;
  change?: number | null;
  suffix?: string;
  accent?: 'violet' | 'blue' | 'teal' | 'orange' | 'default';
  hint?: string;
};

const accentStyles = {
  violet: 'border-cleexs-violet/40 bg-gradient-to-br from-cleexs-violet/20 via-hub-card to-hub-card ring-1 ring-cleexs-violet/30',
  blue: 'border-cleexs-blue/40 bg-gradient-to-br from-cleexs-blue/15 via-hub-card to-hub-card',
  teal: 'border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-hub-card to-hub-card',
  orange: 'border-cleexs-orange/30 bg-gradient-to-br from-cleexs-orange/10 via-hub-card to-hub-card',
  default: 'border-hub-border bg-hub-card',
};

export function MetricsKpiCard({
  label,
  value,
  change,
  suffix = '% vs período anterior',
  accent = 'default',
  hint,
}: Props) {
  const positive = change !== null && change !== undefined && change >= 0;
  const changeText =
    change === null || change === undefined
      ? null
      : `${change > 0 ? '+' : ''}${change}${suffix.includes('pts') ? ' pts' : '%'}`;

  return (
    <div className={cn('rounded-2xl border p-5 shadow-hub transition', accentStyles[accent])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-hub-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{formatMetric(value)}</p>
      {changeText ? (
        <p className={cn('mt-2 text-xs font-medium', positive ? 'text-emerald-400' : 'text-rose-400')}>
          <span aria-hidden="true">{positive ? '▲' : '▼'} </span>
          {changeText}
          {!suffix.includes('pts') ? ' vs período anterior' : ' vs período anterior'}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-hub-muted">{hint}</p>
      ) : null}
    </div>
  );
}
