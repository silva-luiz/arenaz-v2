import type { ComponentProps } from 'react';
import { cn } from './cn';

/** Shared look of text-like controls: Input, Textarea and Select. */
export const CONTROL_CLASSES =
  'w-full rounded-button border border-line-strong bg-bg px-4 text-base text-ink placeholder:text-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand aria-invalid:border-red-700 aria-invalid:focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60';

export type InputProps = ComponentProps<'input'>;

/** `ref` is a regular prop in React 19, so `register()` works as is. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input className={cn(CONTROL_CLASSES, 'h-12', className)} {...props} />
  );
}
