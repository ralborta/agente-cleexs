export type ChartSpec = {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title?: string;
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
  /** Aclaración de origen del dato (ej. "Estimación ilustrativa", "Benchmark Cleexs 2026") */
  sourceNote?: string;
};

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

function isValidChartSpec(spec: unknown): spec is ChartSpec {
  if (!spec || typeof spec !== 'object') return false;
  const c = spec as Partial<ChartSpec>;
  if (!['bar', 'line', 'pie', 'doughnut'].includes(c.type as string)) return false;
  if (!Array.isArray(c.labels) || c.labels.length === 0 || c.labels.length > 12) return false;
  if (!Array.isArray(c.datasets) || c.datasets.length === 0 || c.datasets.length > 4) return false;
  return c.datasets.every(
    (d) =>
      d &&
      typeof d.label === 'string' &&
      Array.isArray(d.data) &&
      d.data.length === c.labels!.length &&
      d.data.every((n) => typeof n === 'number' && Number.isFinite(n)),
  );
}

/** Valida/sanitiza un chart propuesto por el LLM; devuelve null si viene malformado (nunca rompe el render). */
export function sanitizeChartSpec(raw: unknown): ChartSpec | null {
  if (!isValidChartSpec(raw)) return null;
  return {
    type: raw.type,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : undefined,
    labels: raw.labels.slice(0, 12).map((l) => String(l).slice(0, 40)),
    datasets: raw.datasets.slice(0, 4).map((d) => ({
      label: String(d.label).slice(0, 60),
      data: d.data.slice(0, 12),
    })),
    sourceNote: typeof raw.sourceNote === 'string' ? raw.sourceNote.slice(0, 160) : undefined,
  };
}

/**
 * Construye la URL pública de QuickChart (sin API key, GET determinístico) para
 * embeber como <img>. QuickChart está pensado justamente para esto: la URL
 * codifica el chart completo, así que es estable indefinidamente.
 */
export function buildQuickChartUrl(spec: ChartSpec): string {
  const isPie = spec.type === 'pie' || spec.type === 'doughnut';
  const isLine = spec.type === 'line';
  const config = {
    type: spec.type,
    data: {
      labels: spec.labels,
      datasets: spec.datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: isPie
          ? spec.labels.map((_, li) => CHART_COLORS[li % CHART_COLORS.length])
          : CHART_COLORS[i % CHART_COLORS.length],
        borderColor: isPie ? '#ffffff' : CHART_COLORS[i % CHART_COLORS.length],
        // En line charts el trazo ES el borde: con borderWidth 0 solo se verían los puntos.
        borderWidth: isLine ? 3 : isPie ? 2 : 0,
        fill: isLine ? false : undefined,
        tension: isLine ? 0.3 : undefined,
      })),
    },
    options: {
      plugins: {
        title: spec.title ? { display: true, text: spec.title, font: { size: 16 } } : undefined,
        legend: { display: spec.datasets.length > 1 || isPie },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  // v=4 es necesario: QuickChart usa Chart.js 2 por defecto y ahí el título
  // vive en options.title, así que options.plugins.title se ignoraría.
  return `https://quickchart.io/chart?c=${encoded}&v=4&backgroundColor=white&width=680&height=380&devicePixelRatio=2&format=png`;
}
