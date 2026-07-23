'use client';

import { cn } from '@/lib/utils';

const styles = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warn: 'border-cleexs-orange/30 bg-cleexs-orange/10 text-orange-200',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  idle: 'border-hub-border bg-[#0b1220]/60 text-hub-muted',
} as const;

export function StatusBadge({
  status,
  label,
}: {
  status: keyof typeof styles;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        styles[status],
      )}
    >
      {label}
    </span>
  );
}
