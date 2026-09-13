import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  kicker: string;
  title: string;
  description: string;
  badge?: string;
  actions?: ReactNode;
  className?: string;
};

/** Hero de página — marca Cleexs + título grande (cambio visual obvio). */
export function PageHero({ kicker, title, description, badge, actions, className }: Props) {
  return (
    <div
      className={cn(
        'relative mb-8 overflow-hidden rounded-2xl border border-cleexs-blue/40 bg-[#07101f] shadow-hub',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cleexs-blue/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-cleexs-orange/20 blur-3xl" />
      <div className="relative border-b border-cleexs-blue/20 bg-cleexs-blue/10 px-6 py-2 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-200">
          {kicker}
        </p>
      </div>
      <div className="relative px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{title}</h2>
          {badge ? <Badge className="bg-cleexs-orange text-white hover:bg-cleexs-orange">{badge}</Badge> : null}
        </div>
        <p className="mt-3 max-w-2xl text-base text-slate-300">{description}</p>
        {actions ? <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
