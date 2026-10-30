import { cn } from './cn';

export interface SkeletonProps {
  /** Size and radius (`h-4 w-24 rounded-button`); there is no default shape. */
  className?: string | undefined;
}

/** Loading placeholder. Decorative: pair it with a labelled busy region. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-line motion-reduce:animate-none',
        className,
      )}
    />
  );
}
