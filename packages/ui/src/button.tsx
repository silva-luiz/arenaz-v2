import type { ComponentProps } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-button font-semibold transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white enabled:hover:bg-[color-mix(in_oklab,var(--color-brand)_88%,black)]',
  secondary:
    'border border-line-strong bg-bg text-ink enabled:hover:bg-surface',
  ghost: 'bg-transparent text-ink enabled:hover:bg-surface',
  danger: 'bg-red-700 text-white enabled:hover:bg-red-800',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-12 px-5 text-base',
  sm: 'h-10 px-4 text-sm',
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string | undefined;
}

/**
 * Class names of a button, for elements that must look like one but are not a
 * `<button>` (for example a `next/link` call to action).
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and tells assistive tech it is busy. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading ? true : undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
      {loading ? <span className="sr-only">{', Aguarde…'}</span> : null}
    </button>
  );
}
