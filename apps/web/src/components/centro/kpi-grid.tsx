import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type KpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  trend?: string;
  href?: string;
};

function KpiCell({ item, last }: { item: KpiItem; last?: boolean }) {
  const inner = (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-hub-muted">{item.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{item.value}</p>
      {item.trend ? <p className="mt-0.5 text-xs text-emerald-400">{item.trend}</p> : null}
      {item.hint && !item.trend ? (
        <p className="mt-0.5 truncate text-xs text-hub-muted">{item.hint}</p>
      ) : null}
    </div>
  );

  return (
    <>
      {item.href ? (
        <Link
          href={item.href}
          className="min-w-0 flex-1 transition hover:bg-white/[0.03]"
        >
          {inner}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{inner}</div>
      )}
      {!last ? <Separator orientation="vertical" className="hidden h-auto self-stretch sm:block" /> : null}
    </>
  );
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <Card className={cn('animate-centro-in overflow-hidden')} style={{ animationDelay: '120ms' }}>
      <CardContent className="flex flex-col p-0 sm:flex-row sm:divide-x-0">
        <div className="flex w-full flex-col sm:flex-row">
          {items.map((item, i) => (
            <KpiCell key={item.label} item={item} last={i === items.length - 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
