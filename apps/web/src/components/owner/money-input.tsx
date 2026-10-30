'use client';

import { formatCents, parseBrlToCents } from '@arenaz/contracts';
import { Input, type InputProps } from '@arenaz/ui';
import { useId, useState } from 'react';

export const INVALID_MONEY_MESSAGE = 'Valor inválido';

export interface MoneyInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  /** Price in cents; null while empty or invalid. */
  value: number | null;
  onChange: (cents: number | null) => void;
}

/** Cents as the plain text people edit: 18050 → "180,50". */
function toEditable(cents: number): string {
  return `${String(Math.floor(cents / 100))},${String(cents % 100).padStart(2, '0')}`;
}

/**
 * A price in BRL. Shows `formatCents(value)` at rest and the raw text while
 * the person types; `parseBrlToCents` reads it. The parent is kept up to date
 * on every keystroke (a submit with Enter never blurs the field) and the text
 * is checked, and reformatted, on blur: "R$ 1.234,50" becomes 123450. Text
 * that is not a price shows "Valor inválido" and reports null.
 *
 * `id`, `aria-describedby` and `aria-invalid` from `Field` land on the input.
 */
export function MoneyInput({
  value,
  onChange,
  onFocus,
  onBlur,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: MoneyInputProps) {
  const errorId = `${useId()}-money-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const shown = draft ?? (value === null ? '' : formatCents(value));
  const description =
    [describedBy, invalid ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <>
      <Input
        inputMode="decimal"
        autoComplete="off"
        {...props}
        value={shown}
        aria-describedby={description}
        aria-invalid={invalid ? true : ariaInvalid}
        onFocus={(event) => {
          setDraft(
            (current) => current ?? (value === null ? '' : toEditable(value)),
          );
          onFocus?.(event);
        }}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          setInvalid(false);
          onChange(parseBrlToCents(text));
        }}
        onBlur={(event) => {
          const text = (draft ?? event.target.value).trim();
          const cents = text === '' ? null : parseBrlToCents(text);
          if (text !== '' && cents === null) {
            setInvalid(true);
            onChange(null);
          } else {
            setDraft(null);
            onChange(cents);
          }
          onBlur?.(event);
        }}
      />
      {invalid ? (
        <p id={errorId} className="text-sm text-red-700">
          {INVALID_MONEY_MESSAGE}
        </p>
      ) : null}
    </>
  );
}
