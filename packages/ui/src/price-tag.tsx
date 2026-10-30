import { formatCents } from '@arenaz/contracts';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export interface PriceTagProps extends Omit<
  ComponentProps<'span'>,
  'children'
> {
  cents: number;
  suffix?: string;
  /** Prefixes "a partir de" (the price is the lowest of several). */
  from?: boolean;
}

/** "R$ 180" for whole reais, "R$ 180,50" otherwise; no floats involved. */
export function formatPrice(cents: number): string {
  return formatCents(cents).replace(/,00$/, '');
}

export function PriceTag({
  cents,
  suffix = '/ hora',
  from = false,
  className,
  ...props
}: PriceTagProps) {
  return (
    <span
      className={cn('inline-flex flex-wrap items-baseline gap-x-1', className)}
      {...props}
    >
      {from ? (
        <>
          <span className="text-sm text-muted">a partir de</span>{' '}
        </>
      ) : null}
      <span className="font-semibold text-ink">{formatPrice(cents)}</span>{' '}
      <span className="text-sm text-muted">{suffix}</span>
    </span>
  );
}
