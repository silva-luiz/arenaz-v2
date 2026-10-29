import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** A call to action, typically a link or button. */
  action?: ReactNode;
  className?: string | undefined;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="max-w-md text-base text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
