'use client';

import type { AnalyticsPeriod } from '@/lib/analytics-types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <Tabs value={String(value)} onValueChange={(v) => onChange(Number(v) as AnalyticsPeriod)}>
      <TabsList>
        {OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={String(option.value)}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
