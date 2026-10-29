import type { ComponentProps } from 'react';
import { cn } from './cn';
import { CONTROL_CLASSES } from './control';

export type InputProps = ComponentProps<'input'>;

/** `ref` is a regular prop in React 19, so `register()` works as is. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input className={cn(CONTROL_CLASSES, 'h-12', className)} {...props} />
  );
}
