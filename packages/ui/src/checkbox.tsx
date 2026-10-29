import type { ComponentProps } from 'react';
import { cn } from './cn';

// Drawn by hand (not the native box) so the border can use --color-line-control
// (3:1 on white). The tick is a ::before clipped to a check shape; in forced
// colors mode the native control comes back.
const CHECKBOX_CLASSES =
  'grid size-5 shrink-0 cursor-pointer appearance-none place-content-center rounded-md border border-line-control bg-bg transition-colors duration-150 before:block before:size-3 before:scale-0 before:bg-white before:transition-transform before:duration-150 before:[clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0,43%_62%)] checked:border-brand checked:bg-brand checked:before:scale-100 motion-reduce:transition-none motion-reduce:before:transition-none forced-colors:appearance-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-invalid:border-red-700 disabled:cursor-not-allowed disabled:opacity-60';

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
      <input type="checkbox" className={CHECKBOX_CLASSES} {...props} />
      <span>{label}</span>
    </label>
  );
}
