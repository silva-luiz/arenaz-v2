import type { ComponentProps } from 'react';
import { cn } from './cn';
import { CONTROL_CLASSES } from './input';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends ComponentProps<'select'> {
  options: SelectOption[];
  /** Shown selected but not pickable, until the user chooses an option. */
  placeholder?: string;
}

export function Select({
  options,
  placeholder,
  className,
  defaultValue,
  value,
  ...props
}: SelectProps) {
  // The placeholder is only pre-selected when the select is uncontrolled and
  // has no default of its own; React forbids passing both value and defaultValue.
  const initial =
    value === undefined && defaultValue === undefined && placeholder
      ? { defaultValue: '' }
      : { defaultValue };

  return (
    <select
      className={cn(CONTROL_CLASSES, 'h-12', className)}
      {...(value === undefined ? initial : { value })}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
