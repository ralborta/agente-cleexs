type KpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  trend?: string;
};

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-hub-muted">
            {item.label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
          {item.trend ? (
            <p className="mt-1 text-xs font-medium text-emerald-400">{item.trend}</p>
          ) : null}
          {item.hint ? <p className="mt-2 text-xs text-hub-muted">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
