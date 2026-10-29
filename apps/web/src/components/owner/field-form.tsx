'use client';

import {
  FIELD_FORMATS,
  SPORTS,
  SPORT_LABELS,
  SURFACES,
  SURFACE_LABELS,
  fieldInputSchema,
  fieldSchema,
  type FieldResponse,
  type Sport,
} from '@arenaz/contracts';
import { Alert, Button, Checkbox, Field, Input, Select } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { apiSend } from '@/lib/api-client';
import { MoneyInput } from './money-input';

const SURFACE_OPTIONS = SURFACES.map((surface) => ({
  value: surface,
  label: SURFACE_LABELS[surface],
}));
const FORMAT_OPTIONS = [
  { value: '', label: 'Sem formato' },
  ...FIELD_FORMATS.map((format) => ({ value: format, label: format })),
];
const SLOT_OPTIONS = ['30', '60', '90'].map((minutes) => ({
  value: minutes,
  label: `${minutes} minutos`,
}));

const INVALID_MESSAGE = 'Corrija os campos destacados.';
const PRICE_MISSING = 'Informe o preço por hora';
const MEASURE_INVALID = 'Medida inválida';

/** What the inputs hold: texts, as typed, and the price in cents. */
interface FormValues {
  name: string;
  sports: Sport[];
  surface: string;
  format: string;
  lengthM: string;
  widthM: string;
  minSlotMinutes: string;
  basePrice: number | null;
  isActive: boolean;
}

type FormField = keyof FormValues;

const EMPTY_VALUES: FormValues = {
  name: '',
  sports: [],
  surface: '',
  format: '',
  lengthM: '',
  widthM: '',
  minSlotMinutes: '60',
  basePrice: null,
  isActive: true,
};

/** 15.5 → "15,5" */
function meters(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

function toFormValues(field: FieldResponse): FormValues {
  return {
    name: field.name,
    sports: field.sports,
    surface: field.surface,
    format: field.format ?? '',
    lengthM: meters(field.lengthM),
    widthM: meters(field.widthM),
    minSlotMinutes: String(field.minSlotMinutes),
    basePrice: field.basePriceCentsPerHour,
    isActive: field.isActive,
  };
}

/** "28,5" → 28.5; empty → undefined; anything else → NaN. */
function parseMeters(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  return /^\d+(?:[.,]\d+)?$/.test(trimmed)
    ? Number(trimmed.replace(',', '.'))
    : Number.NaN;
}

/** Schema and server names for the same thing, as the form calls them. */
const FIELD_OF_KEY: Record<string, FormField | undefined> = {
  name: 'name',
  sports: 'sports',
  surface: 'surface',
  format: 'format',
  lengthM: 'lengthM',
  widthM: 'widthM',
  minSlotMinutes: 'minSlotMinutes',
  basePriceCentsPerHour: 'basePrice',
  isActive: 'isActive',
};

type Notice = { tone: 'error' | 'success'; text: string } | null;

export interface FieldFormProps {
  venueId: string;
  /** Present when editing; absent when creating. */
  field?: FieldResponse;
}

export function FieldForm({ venueId, field }: FieldFormProps) {
  const router = useRouter();
  const editing = field !== undefined;
  const ids = useId();
  const [notice, setNotice] = useState<Notice>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: field ? toFormValues(field) : EMPTY_VALUES,
  });

  function flag(name: FormField, type: string, message: string) {
    setError(name, { type, message });
  }

  async function onSubmit(values: FormValues) {
    setNotice(null);

    const lengthM = parseMeters(values.lengthM);
    const widthM = parseMeters(values.widthM);
    let blocked = false;
    if (lengthM !== undefined && Number.isNaN(lengthM)) {
      flag('lengthM', 'measure', MEASURE_INVALID);
      blocked = true;
    }
    if (widthM !== undefined && Number.isNaN(widthM)) {
      flag('widthM', 'measure', MEASURE_INVALID);
      blocked = true;
    }
    if (values.basePrice === null) {
      flag('basePrice', 'required', PRICE_MISSING);
      blocked = true;
    }

    const parsed = fieldInputSchema.safeParse({
      name: values.name,
      sports: values.sports,
      surface: values.surface,
      format: values.format === '' ? null : values.format,
      ...(lengthM === undefined || Number.isNaN(lengthM) ? {} : { lengthM }),
      ...(widthM === undefined || Number.isNaN(widthM) ? {} : { widthM }),
      minSlotMinutes: Number(values.minSlotMinutes),
      basePriceCentsPerHour: values.basePrice ?? 0,
      isActive: values.isActive,
    });
    if (!parsed.success) {
      blocked = true;
      const seen = new Set<FormField>();
      for (const issue of parsed.error.issues) {
        const name = FIELD_OF_KEY[String(issue.path[0])];
        // The price and measures were reported above, in their own words.
        if (name === undefined || seen.has(name)) continue;
        if (name === 'basePrice' && values.basePrice === null) continue;
        seen.add(name);
        flag(name, 'schema', issue.message);
      }
    }
    if (blocked || !parsed.success) {
      setNotice({ tone: 'error', text: INVALID_MESSAGE });
      return;
    }

    // On edit an empty measure is sent as null, which clears it on the server
    // (leaving it out would keep the old value). On create, absent means null.
    const result = field
      ? await apiSend(
          'PATCH',
          `/owner/fields/${field.id}`,
          {
            ...parsed.data,
            lengthM: parsed.data.lengthM ?? null,
            widthM: parsed.data.widthM ?? null,
          },
          fieldSchema,
        )
      : await apiSend(
          'POST',
          `/owner/venues/${venueId}/fields`,
          parsed.data,
          fieldSchema,
        );

    if (!result.ok) {
      const unplaced: string[] = [];
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        const name = FIELD_OF_KEY[key];
        const first = messages[0];
        if (first === undefined) continue;
        if (name === undefined) unplaced.push(...messages);
        else flag(name, 'server', first);
      }
      setNotice({
        tone: 'error',
        text: [result.message, ...unplaced].join(' '),
      });
      return;
    }
    if (!field) {
      setRedirecting(true);
      router.replace(`/painel/quadras/${result.data.id}`);
      return;
    }
    reset(toFormValues(result.data));
    setNotice({ tone: 'success', text: 'Quadra salva' });
    router.refresh();
  }

  const sportsErrorId = `${ids}-esportes-error`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-6"
    >
      {/* Nothing can change while the request is in flight. */}
      <fieldset
        disabled={isSubmitting || redirecting}
        className="flex min-w-0 flex-col gap-6"
      >
        <Field label="Nome da quadra" error={errors.name?.message}>
          <Input autoComplete="off" {...register('name')} />
        </Field>

        <fieldset
          aria-describedby={errors.sports ? sportsErrorId : undefined}
          className="flex flex-col gap-3"
        >
          <legend className="mb-1 text-sm font-medium">Esportes</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SPORTS.map((sport) => (
              <Checkbox
                key={sport}
                label={SPORT_LABELS[sport]}
                value={sport}
                {...register('sports')}
              />
            ))}
          </div>
          {errors.sports?.message ? (
            <p id={sportsErrorId} className="text-sm text-red-700">
              {errors.sports.message}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Piso" error={errors.surface?.message}>
            <Select
              options={SURFACE_OPTIONS}
              placeholder="Selecione"
              {...register('surface')}
            />
          </Field>
          <Field label="Formato" error={errors.format?.message}>
            <Select options={FORMAT_OPTIONS} {...register('format')} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Comprimento (m)"
            hint="Opcional."
            error={errors.lengthM?.message}
          >
            <Input inputMode="decimal" {...register('lengthM')} />
          </Field>
          <Field
            label="Largura (m)"
            hint="Opcional."
            error={errors.widthM?.message}
          >
            <Input inputMode="decimal" {...register('widthM')} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Duração mínima"
            hint="Menor tempo que dá para reservar."
            error={errors.minSlotMinutes?.message}
          >
            <Select options={SLOT_OPTIONS} {...register('minSlotMinutes')} />
          </Field>
          <Controller
            control={control}
            name="basePrice"
            render={({ field: price }) => (
              <Field
                label="Preço base por hora"
                hint="Vale quando nenhuma faixa de preço se aplica."
                error={errors.basePrice?.message}
              >
                <MoneyInput
                  name={price.name}
                  value={price.value}
                  onChange={price.onChange}
                  onBlur={price.onBlur}
                />
              </Field>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Checkbox label="Quadra ativa" {...register('isActive')} />
          {errors.isActive?.message ? (
            <p className="text-sm text-red-700">{errors.isActive.message}</p>
          ) : null}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4">
        <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
        <Button
          type="submit"
          loading={isSubmitting || redirecting}
          className="self-start"
        >
          {editing ? 'Salvar alterações' : 'Criar quadra'}
        </Button>
      </div>
    </form>
  );
}
