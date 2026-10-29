import type { ComponentProps } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'brand' | 'free' | 'warning';

// Text colors are picked for WCAG AA on their own background; `--color-free`
// is only used for the decorative dot because it is too light for text.
const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface text-ink',
  brand: 'border-brand bg-brand text-white',
  free: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: BadgeTone;
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {tone === 'free' ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-free" />
      ) : null}
      {children}
    </span>
  );
}
