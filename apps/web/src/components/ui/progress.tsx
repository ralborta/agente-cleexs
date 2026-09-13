import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: ComponentProps<'div'> & { value?: number; indicatorClassName?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-hub-border/80', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-cleexs-blue transition-[width] duration-500 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
