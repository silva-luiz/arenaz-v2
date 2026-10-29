'use client';

import {
  AMENITIES,
  AMENITY_LABELS,
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_DESCRIPTIONS,
  CANCELLATION_POLICY_LABELS,
  BRAZIL_TIMEZONES,
  TIMEZONE_LABELS,
  UF,
  cepLookupResponseSchema,
  defaultTimezoneForUf,
  venueInputSchema,
  venueSchema,
  type Venue,
  type VenueFormInput,
  type VenueInput,
} from '@arenaz/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { Controller, useForm, type DefaultValues } from 'react-hook-form';
import { apiSend, type ApiResult } from '@/lib/api-client';
import { formatCep, formatPhoneBr } from '@/lib/format-br';
import { LocationPicker } from './location-picker';

const UF_OPTIONS = UF.map((uf) => ({ value: uf, label: uf }));
const TIMEZONE_OPTIONS = BRAZIL_TIMEZONES.map((zone) => ({
  value: zone,
  label: TIMEZONE_LABELS[zone],
}));
const INVALID_MESSAGE = 'Corrija os campos destacados.';
const LOCATION_BLANK_MESSAGE = 'Informe a localização do espaço';

/**
 * "Not set yet" for the location: NaN fails the schema's number check, so the
 * form cannot be submitted, and `LocationPicker` shows the fields empty.
 */
const UNSET_LOCATION = { lat: Number.NaN, lng: Number.NaN };

const EMPTY_VALUES: DefaultValues<VenueFormInput> = {
  name: '',
  description: '',
  phone: '',
  address: {
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
  },
  location: UNSET_LOCATION,
  amenities: [],
  timezone: defaultTimezoneForUf(''),
};

function toFormValues(venue: Venue): VenueFormInput {
  return {
    name: venue.name,
    description: venue.description ?? '',
    phone: formatPhoneBr(venue.phone),
    address: {
      cep: formatCep(venue.address.cep),
      street: venue.address.street,
      number: venue.address.number,
      complement: venue.address.complement ?? '',
      neighborhood: venue.address.neighborhood,
      city: venue.address.city,
      state: venue.address.state,
    },
    location: venue.location,
    amenities: venue.amenities,
    cancellationPolicy: venue.cancellationPolicy,
    timezone: venue.timezone,
  };
}

/**
 * On create, empty optional texts are left out. On edit they are sent as they
 * are, so clearing the description or the complement clears it on the server.
 */
function toPayload(values: VenueInput, editing: boolean): VenueInput {
  if (editing) return values;
  const { description, address, ...rest } = values;
  const { complement, ...addressRest } = address;
  return {
    ...rest,
    ...(description ? { description } : {}),
    address: { ...addressRest, ...(complement ? { complement } : {}) },
  };
}

const SERVER_FIELDS = [
  'name',
  'description',
  'phone',
  'amenities',
  'cancellationPolicy',
  'timezone',
] as const;
type ServerField = (typeof SERVER_FIELDS)[number];

function isServerField(field: string): field is ServerField {
  return (SERVER_FIELDS as readonly string[]).includes(field);
}

type Notice = { tone: 'error' | 'success'; text: string } | null;

export interface VenueFormProps {
  /** Present when editing; absent when creating. */
  venue?: Venue;
}

export function VenueForm({ venue }: VenueFormProps) {
  const router = useRouter();
  const editing = venue !== undefined;
  const ids = useId();
  const [notice, setNotice] = useState<Notice>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [cepStatus, setCepStatus] = useState('');
  // CEP (digits) whose lookup last succeeded; in edit mode, the saved one.
  const lastLookup = useRef(venue?.address.cep ?? '');
  // CEP (digits) being looked up right now, if any.
  const pendingLookup = useRef('');
  const lookupTicket = useRef(0);
  // The zone follows the UF only while creating, until the owner picks one by
  // hand. An existing venue keeps its zone: its bookings and hours are in it,
  // and the API refuses a change while there are future bookings.
  const timezoneChosen = useRef(venue !== undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VenueFormInput, unknown, VenueInput>({
    resolver: zodResolver(venueInputSchema),
    defaultValues: venue ? toFormValues(venue) : EMPTY_VALUES,
  });

  const cep = register('address.cep');
  const state = register('address.state');
  const timezone = register('timezone');

  function followState(uf: string) {
    if (timezoneChosen.current) return;
    setValue('timezone', defaultTimezoneForUf(uf), { shouldDirty: true });
  }

  async function lookupCep(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (
      digits.length !== 8 ||
      digits === lastLookup.current ||
      digits === pendingLookup.current
    ) {
      return;
    }
    pendingLookup.current = digits;
    const ticket = ++lookupTicket.current;
    setCepStatus('Buscando endereço…');

    const result = await apiSend(
      'GET',
      `/geo/cep/${digits}`,
      undefined,
      cepLookupResponseSchema,
    );
    // A newer lookup (the owner kept editing the CEP) wins.
    if (ticket !== lookupTicket.current) return;

    pendingLookup.current = '';
    if (!result.ok) {
      setCepStatus('');
      setError('address.cep', {
        type: 'lookup',
        message: result.fieldErrors.cep?.[0] ?? result.message,
      });
      return;
    }

    lastLookup.current = digits;
    const { data } = result;
    const fill = { shouldDirty: true, shouldValidate: true };
    clearErrors('address.cep');
    setValue('address.cep', formatCep(digits), { shouldDirty: true });
    // A CEP that covers a whole city comes with no street or neighborhood;
    // keep whatever the owner already typed in that case.
    if (data.street) setValue('address.street', data.street, fill);
    if (data.neighborhood) {
      setValue('address.neighborhood', data.neighborhood, fill);
    }
    if (data.city) setValue('address.city', data.city, fill);
    setValue('address.state', data.state, fill);
    followState(data.state);
    // Without coordinates the owner places the pin.
    if (data.location) setValue('location', data.location, fill);
    setCepStatus('Endereço preenchido.');
  }

  function showServerFailure(
    result: Extract<ApiResult<unknown>, { ok: false }>,
  ) {
    const unplaced: string[] = [];
    for (const [field, messages] of Object.entries(result.fieldErrors)) {
      const first = messages[0];
      if (first === undefined) continue;
      if (isServerField(field)) {
        setError(field, { type: 'server', message: first });
      } else {
        // address and location errors are nested; say them in the alert.
        unplaced.push(...messages);
      }
    }
    setNotice({
      tone: 'error',
      text: [result.message, ...unplaced].join(' '),
    });
  }

  async function onSubmit(values: VenueInput) {
    setNotice(null);
    const payload = toPayload(values, editing);
    const result = venue
      ? await apiSend(
          'PATCH',
          `/owner/venues/${venue.id}`,
          payload,
          venueSchema,
        )
      : await apiSend('POST', '/owner/venues', payload, venueSchema);

    if (!result.ok) {
      showServerFailure(result);
      return;
    }
    if (!venue) {
      setRedirecting(true);
      router.replace(`/painel/espacos/${result.data.id}`);
      return;
    }
    reset(toFormValues(result.data));
    setNotice({ tone: 'success', text: 'Espaço salvo' });
    router.refresh();
  }

  const headings = {
    data: `${ids}-dados`,
    address: `${ids}-endereco`,
    location: `${ids}-localizacao`,
    amenities: `${ids}-comodidades`,
    cancellation: `${ids}-cancelamento`,
  };
  const cancellationErrorId = `${ids}-cancelamento-error`;
  const amenitiesErrorId = `${ids}-comodidades-error`;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit, () => {
          setNotice({ tone: 'error', text: INVALID_MESSAGE });
        })(event);
      }}
      className="flex flex-col gap-10"
    >
      <section aria-labelledby={headings.data} className="flex flex-col gap-5">
        <h2 id={headings.data} className="text-lg font-bold">
          Dados
        </h2>
        <Field label="Nome do espaço" error={errors.name?.message}>
          <Input autoComplete="off" {...register('name')} />
        </Field>
        <Field
          label="Descrição"
          hint="Opcional. Conte o que o espaço tem de especial."
          error={errors.description?.message}
        >
          <Textarea {...register('description')} />
        </Field>
        <Field
          label="Telefone"
          hint="Com DDD, por exemplo (11) 98765-4321."
          error={errors.phone?.message}
        >
          <Input type="tel" autoComplete="tel" {...register('phone')} />
        </Field>
      </section>

      <section
        aria-labelledby={headings.address}
        className="flex flex-col gap-5"
      >
        <h2 id={headings.address} className="text-lg font-bold">
          Endereço
        </h2>
        <Field
          label="CEP"
          hint={cepStatus === 'Buscando endereço…' ? cepStatus : undefined}
          error={errors.address?.cep?.message}
          className="sm:max-w-48"
        >
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            {...cep}
            onChange={(event) => {
              // A lookup still in flight is about the old value. Typing a digit
              // and taking it back leaves lastLookup alone, so the CEP is not
              // looked up again over a pin the owner placed by hand.
              const digits = event.target.value.replace(/\D/g, '');
              if (digits !== pendingLookup.current) {
                lookupTicket.current += 1;
                pendingLookup.current = '';
              }
              setCepStatus('');
              if (errors.address?.cep?.type === 'lookup') {
                clearErrors('address.cep');
              }
              void cep.onChange(event);
            }}
            onBlur={(event) => {
              void cep.onBlur(event);
              void lookupCep(event.target.value);
            }}
          />
        </Field>
        <p role="status" className="sr-only">
          {cepStatus}
        </p>
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field label="Rua" error={errors.address?.street?.message}>
            <Input {...register('address.street')} />
          </Field>
          <Field label="Número" error={errors.address?.number?.message}>
            <Input {...register('address.number')} />
          </Field>
        </div>
        <Field
          label="Complemento"
          hint="Opcional."
          error={errors.address?.complement?.message}
        >
          <Input {...register('address.complement')} />
        </Field>
        <Field label="Bairro" error={errors.address?.neighborhood?.message}>
          <Input {...register('address.neighborhood')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field label="Cidade" error={errors.address?.city?.message}>
            <Input {...register('address.city')} />
          </Field>
          <Field label="UF" error={errors.address?.state?.message}>
            <Select
              options={UF_OPTIONS}
              placeholder="Selecione"
              {...state}
              onChange={(event) => {
                followState(event.target.value);
                void state.onChange(event);
              }}
            />
          </Field>
        </div>
        <Field
          label="Fuso horário"
          hint="Os horários das quadras e das reservas seguem este fuso."
          error={errors.timezone?.message}
          className="sm:max-w-96"
        >
          <Select
            options={TIMEZONE_OPTIONS}
            {...timezone}
            onChange={(event) => {
              timezoneChosen.current = true;
              void timezone.onChange(event);
            }}
          />
        </Field>
      </section>

      <section
        aria-labelledby={headings.location}
        className="flex flex-col gap-5"
      >
        <h2 id={headings.location} className="text-lg font-bold">
          Localização
        </h2>
        <Controller
          control={control}
          name="location"
          render={({ field }) => {
            const current = field.value as
              { lat: number; lng: number } | undefined;
            const value =
              current &&
              Number.isFinite(current.lat) &&
              Number.isFinite(current.lng)
                ? current
                : null;
            const failing = errors.location !== undefined;
            return (
              <LocationPicker
                value={value}
                latitudeRef={field.ref}
                onChange={(next) => {
                  field.onChange(next ?? UNSET_LOCATION);
                }}
                errors={
                  !failing
                    ? undefined
                    : value === null
                      ? { lat: LOCATION_BLANK_MESSAGE }
                      : {
                          lat: errors.location?.lat?.message,
                          lng: errors.location?.lng?.message,
                        }
                }
              />
            );
          }}
        />
      </section>

      <section
        aria-labelledby={headings.amenities}
        className="flex flex-col gap-4"
      >
        <h2 id={headings.amenities} className="text-lg font-bold">
          Comodidades
        </h2>
        <div
          role="group"
          aria-labelledby={headings.amenities}
          aria-describedby={errors.amenities ? amenitiesErrorId : undefined}
          className="grid gap-4 sm:grid-cols-2"
        >
          {AMENITIES.map((amenity) => (
            <Checkbox
              key={amenity}
              label={AMENITY_LABELS[amenity]}
              value={amenity}
              {...register('amenities')}
            />
          ))}
        </div>
        {errors.amenities?.message ? (
          <p id={amenitiesErrorId} className="text-sm text-red-700">
            {errors.amenities.message}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby={headings.cancellation}
        className="flex flex-col gap-4"
      >
        <h2 id={headings.cancellation} className="text-lg font-bold">
          Cancelamento
        </h2>
        <div
          role="radiogroup"
          aria-labelledby={headings.cancellation}
          aria-describedby={
            errors.cancellationPolicy ? cancellationErrorId : undefined
          }
          className="flex flex-col gap-3"
        >
          {CANCELLATION_POLICIES.map((policy) => {
            const nameId = `${ids}-${policy}-nome`;
            const descriptionId = `${ids}-${policy}-descricao`;
            return (
              <label
                key={policy}
                className="flex cursor-pointer items-start gap-3 rounded-button border border-line-control p-4 has-checked:border-brand has-checked:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
              >
                <input
                  type="radio"
                  value={policy}
                  aria-labelledby={nameId}
                  aria-describedby={descriptionId}
                  className="mt-0.5 size-5 shrink-0 accent-brand"
                  {...register('cancellationPolicy')}
                />
                <span>
                  <span id={nameId} className="block font-semibold">
                    {CANCELLATION_POLICY_LABELS[policy]}
                  </span>
                  <span id={descriptionId} className="block text-sm text-muted">
                    {CANCELLATION_POLICY_DESCRIPTIONS[policy]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.cancellationPolicy?.message ? (
          <p id={cancellationErrorId} className="text-sm text-red-700">
            {errors.cancellationPolicy.message}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-4">
        <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
        <Button
          type="submit"
          loading={isSubmitting || redirecting}
          className="self-start"
        >
          {editing ? 'Salvar alterações' : 'Criar espaço'}
        </Button>
      </div>
    </form>
  );
}
