import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export type AlertTone = 'error' | 'info' | 'success';

const TONES: Record<AlertTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export interface AlertProps extends Omit<ComponentProps<'div'>, 'role'> {
  tone: AlertTone;
  children?: ReactNode;
}

function hasMessage(children: ReactNode): boolean {
  return (
    children !== null &&
    children !== undefined &&
    children !== false &&
    children !== ''
  );
}

/**
 * Always rendered with `role="alert"`: an implicit live region only announces
 * text that is inserted into a region that already exists, so the region has
 * to be in the DOM before the message arrives. Without a message it renders
 * empty and visually hidden (and out of the layout flow).
 */
export function Alert({ tone, className, children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        hasMessage(children)
          ? cn('rounded-button border px-4 py-3 text-sm', TONES[tone])
          : 'sr-only',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
