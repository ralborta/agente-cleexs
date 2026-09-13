'use client';

import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const TabsContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within Tabs');
  return ctx;
}

function Tabs({
  className,
  value,
  onValueChange,
  children,
  ...props
}: ComponentProps<'div'> & {
  value: string;
  onValueChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('inline-flex', className)} data-value={value} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-hub-border bg-[#0b1220] p-1',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: ComponentProps<'button'> & { value: string }) {
  const { value: current, onValueChange } = useTabs();
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      className={cn(
        'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'bg-cleexs-blue text-white shadow-sm shadow-cleexs-blue/25'
          : 'text-hub-muted hover:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Tabs, TabsList, TabsTrigger };
