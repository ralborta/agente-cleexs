'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = {
  dateFrom?: string | null;
  dateTo?: string | null;
  value?: number | null;
};

type Props = {
  data: Point[];
};

function formatLabel(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-hub-border bg-[#0f172a]/95 px-4 py-3 shadow-hub backdrop-blur">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-hub-muted">{label}</p>
      <p className="text-sm font-semibold text-white">Interest {payload[0]?.value ?? '—'}</p>
    </div>
  );
}

export function YoutubeInterestChart({ data }: Props) {
  const series = data
    .map((p) => ({
      label: formatLabel(p.dateFrom ?? p.dateTo),
      interest: typeof p.value === 'number' ? p.value : null,
    }))
    .filter((p) => p.interest != null);

  if (!series.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-hub-border bg-[#0b1220]/40">
        <p className="text-sm text-hub-muted">Sin serie de interés YouTube todavía.</p>
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="fillYtInterest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.45} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="interest"
            name="YouTube interest"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#fillYtInterest)"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
