'use client';

import { blockInputSchema, blockSchema } from '@arenaz/contracts';
import { Alert, Button, Field, Input, Select } from '@arenaz/ui';
import { useEffect, useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { addDaysToDateKey } from '@/lib/booking-client';
import { toZonedIso } from '@/lib/zoned-time';
import { TIME_OPTIONS } from './time-options';

const DEFAULT_START = 18 * 60;
const DEFAULT_END = 22 * 60;
/** Bookings are accepted up to 60 days ahead. */
const MAX_DAYS_AHEAD = 60;
const DATE_MISSING = 'Informe a data';
const FIELD_MISSING = 'Escolha a quadra';

type FormField = 'fieldId' | 'date' | 'startsAt' | 'endsAt' | 'reason';
type FormErrors = Partial<Record<FormField, string>>;

function isFormField(key: string): key is FormField {
  return key === 'startsAt' || key === 'endsAt' || key === 'reason';
}

export interface AgendaBlockFormProps {
  fields: { id: string; name: string }[];
  /** IANA zone of the venue: every time here is read and written in it. */
  timezone: string;
  /** Day of the agenda being shown, "YYYY-MM-DD". */
  date: string;
  /** Today in the venue's zone, the earliest day that can be chosen. */
  today: string;
  onDone: (message: string) => void;
  /** Told when a request starts and ends (the dialog cannot close meanwhile). */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Closes a period of one court (maintenance, a tournament, rain). The server
 * refuses (409) a period that overlaps an active booking.
 */
export function AgendaBlockForm({
  fields,
  timezone,
  date: initialDate,
  today,
  onDone,
  onBusyChange,
}: AgendaBlockFormProps) {
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '');
  const [date, setDate] = useState(initialDate);
  const [startMinute, setStartMinute] = useState(DEFAULT_START);
  const [endMinute, setEndMinute] = useState(DEFAULT_END);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onBusyChange?.(saving);
  }, [saving, onBusyChange]);

  async function submit() {
    setError(undefined);
    setErrors({});
    if (fieldId === '') {
      setErrors({ fieldId: FIELD_MISSING });
      return;
    }
    if (date === '') {
      setErrors({ date: DATE_MISSING });
      return;
    }

    const trimmed = reason.trim();
    const parsed = blockInputSchema.safeParse({
      startsAt: toZonedIso(date, startMinute, timezone),
      endsAt: toZonedIso(date, endMinute, timezone),
      ...(trimmed ? { reason: trimmed } : {}),
    });
    if (!parsed.success) {
      const found: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (isFormField(key) && found[key] === undefined) {
          found[key] = issue.message;
        }
      }
      setErrors(found);
      return;
    }

    setSaving(true);
    const result = await apiSend(
      'POST',
      `/owner/fields/${fieldId}/blocks`,
      parsed.data,
      blockSchema,
    );
    setSaving(false);
    if (!result.ok) {
      const found: FormErrors = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        const first = messages[0];
        if (isFormField(key) && first !== undefined) found[key] = first;
      }
      setErrors(found);
      setError(result.message);
      return;
    }
    onDone('Horário bloqueado');
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
        <Field label="Quadra" error={errors.fieldId}>
          <Select
            options={fields.map((field) => ({
              value: field.id,
              label: field.name,
            }))}
            value={fieldId}
            onChange={(event) => {
              setFieldId(event.target.value);
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data" error={errors.date}>
            <Input
              type="date"
              min={today}
              max={addDaysToDateKey(today, MAX_DAYS_AHEAD)}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
              }}
            />
          </Field>
          <Field label="Início" error={errors.startsAt}>
            <Select
              options={TIME_OPTIONS}
              value={String(startMinute)}
              onChange={(event) => {
                setStartMinute(Number(event.target.value));
              }}
            />
          </Field>
          <Field label="Fim" error={errors.endsAt}>
            <Select
              options={TIME_OPTIONS}
              value={String(endMinute)}
              onChange={(event) => {
                setEndMinute(Number(event.target.value));
              }}
            />
          </Field>
        </div>
        <Field label="Motivo" hint="Opcional." error={errors.reason}>
          <Input
            value={reason}
            maxLength={120}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </Field>
      </fieldset>
      <Alert tone="error">{error}</Alert>
      <Button type="submit" loading={saving} className="self-start">
        Bloquear
      </Button>
    </form>
  );
}
