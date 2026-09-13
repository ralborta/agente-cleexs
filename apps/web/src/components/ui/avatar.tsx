import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Avatar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-hub-border',
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-cleexs-blue/20 text-sm font-semibold text-blue-100',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
