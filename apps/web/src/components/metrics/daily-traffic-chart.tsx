'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsDashboard } from '@/lib/analytics-types';
import { formatMetric } from '@/lib/analytics-types';

type Props = {
  data: AnalyticsDashboard['dailySeries'];
};

const COLORS = {
  total: '#64748b',
  ai: '#14b8a6',
  google: '#2563eb',
  chatgpt: '#2dd4bf',
  perplexity: '#a78bfa',
  claude: '#fb923c',
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-hub-border bg-[#0f172a]/95 px-4 py-3 shadow-hub backdrop-blur">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-hub-muted">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-white">{formatMetric(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DailyTrafficChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-hub-border bg-[#0b1220]/40">
        <p className="text-sm text-hub-muted">Sin datos diarios todavía. Verificá GA4 y el sync de métricas.</p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.total} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS.total} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillAi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.ai} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORS.ai} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 12, fontSize: 12, color: '#cbd5e1' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Visitas blog"
            stroke={COLORS.total}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#fillTotal)"
          />
          <Area
            type="monotone"
            dataKey="ai"
            name="Desde IA"
            stroke={COLORS.ai}
            strokeWidth={2.5}
            fill="url(#fillAi)"
          />
          <Area
            type="monotone"
            dataKey="google"
            name="Google"
            stroke={COLORS.google}
            strokeWidth={2}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="chatgpt"
            name="ChatGPT"
            stroke={COLORS.chatgpt}
            strokeWidth={1.5}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="perplexity"
            name="Perplexity"
            stroke={COLORS.perplexity}
            strokeWidth={1.5}
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="claude"
            name="Claude"
            stroke={COLORS.claude}
            strokeWidth={1.5}
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
