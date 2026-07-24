import Link from 'next/link';

type KpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  trend?: string;
  href?: string;
};

function KpiCard({ item }: { item: KpiItem }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-hub-muted">{item.label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
      {item.trend ? (
        <p className="mt-1 text-xs font-medium text-emerald-400">{item.trend}</p>
      ) : null}
      {item.hint ? <p className="mt-2 text-xs text-hub-muted">{item.hint}</p> : null}
      {item.href ? <p className="mt-3 text-xs font-medium text-cleexs-blue">Abrir →</p> : null}
    </>
  );

  const className =
    'rounded-2xl border border-hub-border bg-hub-card p-4 shadow-hub transition hover:border-cleexs-blue/40';

  if (item.href) {
    return (
      <Link href={item.href} className={`${className} block`}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </div>
  );
}
