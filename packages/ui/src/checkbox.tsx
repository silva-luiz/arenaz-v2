import type { ComponentProps } from 'react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: string;
}

/** `className` styles the wrapping label; everything else goes to the input. */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-3 text-base text-ink',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-5 shrink-0 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
