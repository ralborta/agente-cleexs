import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  violet: 'border-cleexs-violet/35 bg-gradient-to-br from-cleexs-violet/15 via-hub-card to-hub-card',
  blue: 'border-cleexs-blue/35 bg-gradient-to-br from-cleexs-blue/15 via-hub-card to-hub-card',
  teal: 'border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-hub-card to-hub-card',
  orange: 'border-cleexs-orange/30 bg-gradient-to-br from-cleexs-orange/10 via-hub-card to-hub-card',
  default: '',
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
    <Card
      className={cn(
        'animate-centro-in transition hover:-translate-y-0.5 hover:border-cleexs-blue/40',
        accentStyles[accent],
      )}
    >
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-hub-muted">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
          {formatMetric(value)}
        </p>
        {changeText ? (
          <Badge
            variant={positive ? 'success' : 'outline'}
            className={cn('mt-3 font-medium', !positive && 'border-rose-400/30 text-rose-300')}
          >
            {positive ? '▲' : '▼'} {changeText}
            {!suffix.includes('pts') ? ' vs ant.' : ' vs ant.'}
          </Badge>
        ) : hint ? (
          <p className="mt-3 text-xs text-hub-muted">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
