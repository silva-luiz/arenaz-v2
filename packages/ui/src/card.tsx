import type { ComponentProps } from 'react';
import { cn } from './cn';

export interface CardProps extends Omit<ComponentProps<'section'>, 'ref'> {
  as?: 'section' | 'div';
}

/** White surface on `--shadow-2`, 24px radius. */
export function Card({
  as: Tag = 'section',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        'w-full rounded-card border border-line bg-bg p-6 shadow-2 sm:p-8',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
