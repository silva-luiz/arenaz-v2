'use client';

import {
  BOOKING_MAX_MINUTES,
  manualBookingInputSchema,
} from '@arenaz/contracts';
import { Alert, Button, Field, Input, Select } from '@arenaz/ui';
import { useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { toZonedIso } from '@/lib/zoned-time';
import { TIME_OPTIONS } from './time-options';

const STEP = 30;
const DEFAULT_START = 18 * 60;
const DEFAULT_DURATION = 60;
const DATE_MISSING = 'Informe a data';
const FIELD_MISSING = 'Escolha a quadra';

// A booking starts at 23:30 at the latest: 24:00 is only an end.
const START_OPTIONS = TIME_OPTIONS.filter(
  (option) => Number(option.value) < 24 * 60,
);

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0
    ? `${String(hours)} h`
    : `${String(hours)} h ${String(rest)}`;
}

const DURATION_OPTIONS = Array.from(
  { length: BOOKING_MAX_MINUTES / STEP },
  (_, index) => {
    const minutes = (index + 1) * STEP;
    return { value: String(minutes), label: durationLabel(minutes) };
  },
);

type FormField =
  | 'fieldId'
  | 'date'
  | 'startsAt'
  | 'durationMinutes'
  | 'customerName'
  | 'customerPhone';
type FormErrors = Partial<Record<FormField, string>>;

const FORM_FIELDS: readonly string[] = [
  'startsAt',
  'durationMinutes',
  'customerName',
  'customerPhone',
];

function isFormField(key: string): key is FormField {
  return FORM_FIELDS.includes(key);
}

export interface ManualBookingFormProps {
  /** Active courts only. */
  fields: { id: string; name: string }[];
  /** IANA zone of the venue: every time here is read and written in it. */
  timezone: string;
  /** Day of the agenda being shown, "YYYY-MM-DD". */
  date: string;
  /** Today in the venue's zone, the earliest day that can be chosen. */
  today: string;
  onDone: (message: string) => void;
}

/**
 * Booking the owner makes by hand (phone, counter, WhatsApp): confirmed on
 * the spot, paid at the venue. The server prices it and refuses (409) what
 * overlaps another booking or a block.
 */
export function ManualBookingForm({
  fields,
  timezone,
  date: initialDate,
  today,
  onDone,
}: ManualBookingFormProps) {
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '');
  const [date, setDate] = useState(initialDate);
  const [startMinute, setStartMinute] = useState(DEFAULT_START);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

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

    const parsed = manualBookingInputSchema.safeParse({
      startsAt: toZonedIso(date, startMinute, timezone),
      durationMinutes: duration,
      customerName: name,
      customerPhone: phone,
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
      `/owner/fields/${fieldId}/bookings`,
      parsed.data,
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
    onDone('Reserva manual criada');
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
      {/* Nothing can change while the booking is being saved. */}
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
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
              }}
            />
          </Field>
          <Field label="Início" error={errors.startsAt}>
            <Select
              options={START_OPTIONS}
              value={String(startMinute)}
              onChange={(event) => {
                setStartMinute(Number(event.target.value));
              }}
            />
          </Field>
          <Field label="Duração" error={errors.durationMinutes}>
            <Select
              options={DURATION_OPTIONS}
              value={String(duration)}
              onChange={(event) => {
                setDuration(Number(event.target.value));
              }}
            />
          </Field>
        </div>
        <Field label="Nome do cliente" error={errors.customerName}>
          <Input
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </Field>
        <Field
          label="Telefone (opcional)"
          hint="Com DDD."
          error={errors.customerPhone}
        >
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
          />
        </Field>
      </fieldset>
      <p className="text-sm text-muted">
        A reserva fica confirmada na hora, com pagamento no local. O valor é
        calculado pela tabela de preços da quadra.
      </p>
      <Alert tone="error">{error}</Alert>
      <Button type="submit" loading={saving} className="self-start">
        Criar reserva
      </Button>
    </form>
  );
}
