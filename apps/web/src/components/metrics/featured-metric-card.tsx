import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatMetric } from '@/lib/analytics-types';

type FeaturedProps = {
  label: string;
  value: number;
  change?: number | null;
  hint?: string;
  tone?: 'blue' | 'teal' | 'orange' | 'violet';
};

const tones = {
  blue: 'from-cleexs-blue/30 via-hub-card to-hub-card border-cleexs-blue/40',
  teal: 'from-teal-500/25 via-hub-card to-hub-card border-teal-400/35',
  orange: 'from-cleexs-orange/25 via-hub-card to-hub-card border-cleexs-orange/40',
  violet: 'from-cleexs-violet/25 via-hub-card to-hub-card border-cleexs-violet/35',
};

export function FeaturedMetricCard({
  label,
  value,
  change,
  hint,
  tone = 'blue',
}: FeaturedProps) {
  const positive = change !== null && change !== undefined && change >= 0;
  return (
    <Card
      className={cn(
        'overflow-hidden bg-gradient-to-br animate-centro-in',
        tones[tone],
      )}
    >
      <CardContent className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hub-muted">{label}</p>
        <p className="mt-4 text-5xl font-semibold tracking-tight text-white tabular-nums">
          {formatMetric(value)}
        </p>
        {change !== null && change !== undefined ? (
          <Badge
            variant={positive ? 'success' : 'outline'}
            className={cn('mt-4', !positive && 'border-rose-400/30 text-rose-300')}
          >
            {positive ? '▲' : '▼'} {change > 0 ? '+' : ''}
            {change}% vs período anterior
          </Badge>
        ) : hint ? (
          <p className="mt-4 text-sm text-hub-muted">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
