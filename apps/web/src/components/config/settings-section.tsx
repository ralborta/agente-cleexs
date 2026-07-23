import { cn } from '@/lib/utils';

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-hub-border bg-hub-card p-6 shadow-hub', className)}>
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? <p className="mt-1 text-sm text-hub-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{children}</span>
      {hint ? <span className="mt-1 block text-xs text-hub-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  'mt-2 w-full rounded-xl border border-hub-border bg-[#0b1220] px-4 py-2.5 text-sm text-white placeholder:text-hub-muted focus:border-cleexs-blue focus:outline-none focus:ring-1 focus:ring-cleexs-blue/40';

export const buttonPrimaryClassName =
  'rounded-xl bg-cleexs-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-cleexs-blue-dark disabled:opacity-50';

export const buttonSecondaryClassName =
  'rounded-xl border border-hub-border px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-hub-border/20 disabled:opacity-50';
