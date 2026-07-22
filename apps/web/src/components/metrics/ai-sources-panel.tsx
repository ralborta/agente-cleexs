'use client';

import type { AnalyticsDashboard } from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';
import { cn } from '@/lib/utils';

type Props = {
  sources: AnalyticsDashboard['aiSources'];
  totalSessions: number;
};

export function AiSourcesPanel({ sources, totalSessions }: Props) {
  const max = Math.max(...sources.map((s) => s.sessions), 1);

  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-sm text-hub-muted">Sin tráfico clasificado por motor todavía.</p>
      ) : (
        sources.map((source) => {
          const width = Math.max((source.sessions / max) * 100, source.sessions > 0 ? 8 : 0);
          const positive = (source.change ?? 0) >= 0;

          return (
            <div key={source.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{source.label}</p>
                  <p className="text-xs text-hub-muted">{source.share}% del tráfico del blog</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatMetric(source.sessions)}</p>
                  {source.change !== null ? (
                    <p className={cn('text-xs font-medium', positive ? 'text-emerald-400' : 'text-rose-400')}>
                      {positive ? '▲' : '▼'} {source.change > 0 ? '+' : ''}
                      {source.change}%
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#0b1220]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${width}%`, background: source.color }}
                />
              </div>
            </div>
          );
        })
      )}

      <div className="rounded-xl border border-hub-border/70 bg-[#0b1220]/50 px-4 py-3">
        <p className="text-xs text-hub-muted">
          Total blog analizado:{' '}
          <span className="font-semibold text-slate-200">{formatMetric(totalSessions)}</span> sesiones
        </p>
      </div>
    </div>
  );
}
