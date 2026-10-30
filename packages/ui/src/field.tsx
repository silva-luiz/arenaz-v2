import {
  cloneElement,
  useId,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from './cn';

/** Props `Field` injects into its control. */
interface FieldControlProps {
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
}

export interface FieldProps {
  label: string;
  hint?: ReactNode;
  /** Plain text under the control; the form-level announcement is `Alert`. */
  error?: string | undefined;
  className?: string | undefined;
  /** A single `Input`, `Textarea` or `Select`. */
  children: ReactElement<FieldControlProps>;
}

/**
 * Labels one control and wires `id`, `aria-describedby` (hint and/or error)
 * and `aria-invalid` (only with an error) into it.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [
    children.props['aria-describedby'],
    hint ? hintId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const control = cloneElement(children, {
    id,
    'aria-describedby': describedBy || undefined,
    ...(error ? { 'aria-invalid': true } : {}),
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
