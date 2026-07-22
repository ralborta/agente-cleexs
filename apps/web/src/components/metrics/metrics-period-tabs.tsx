'use client';

import { cn } from '@/lib/utils';
import type { AnalyticsPeriod } from '@/lib/analytics-types';

const OPTIONS: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
];

type Props = {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
};

export function MetricsPeriodTabs({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-xl border border-hub-border bg-[#0b1220] p-1">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              active
                ? 'bg-cleexs-violet text-white shadow-sm shadow-cleexs-violet/30'
                : 'text-hub-muted hover:text-white',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
