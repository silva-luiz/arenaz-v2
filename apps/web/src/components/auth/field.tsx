import type { HTMLInputTypeAttribute } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface FieldProps {
  id: string;
  label: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  registration: UseFormRegisterReturn;
  error?: string | undefined;
}

/** Labelled input; the error is announced through `aria-describedby`. */
export function Field({
  id,
  label,
  type = 'text',
  autoComplete,
  registration,
  error,
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-12 rounded-[14px] border border-line-strong bg-bg px-4 text-base text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand aria-invalid:border-red-700 aria-invalid:focus-visible:outline-red-700"
        {...registration}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
