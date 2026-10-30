'use client';

import { DEFAULT_TIMEZONE, TIMEZONE_LABELS } from '@arenaz/contracts';
import {
  Alert,
  Button,
  cn,
  Field,
  FOCUS_RING,
  formatPrice,
  Select,
  Skeleton,
} from '@arenaz/ui';
import { formatZonedTime } from '@/lib/zoned-time';
import { isPeak, useBooking, type GridSlot } from './booking-state';

export type { PickerField } from './booking-state';

const DAY_BUTTON = cn(
  'flex h-[68px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-button border transition-colors duration-150 motion-reduce:transition-none',
  FOCUS_RING,
);

const TIME_BUTTON = cn(
  'flex min-h-[60px] flex-col items-start justify-center gap-[3px] rounded-[12px] border px-3 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none',
  FOCUS_RING,
);

const TIME_GRID =
  'grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))]';

/**
 * Day, court and time of a booking (the "Escolha o horário" section of
 * Quadra.dc.html), on the state of `BookingProvider`: the booking card shows
 * the result and books it. Each time is a button named with its time, price
 * and state ("20:00, R$ 220, nobre, livre"); taken times are crossed out and
 * disabled.
 */
export function SlotPicker() {
  const {
    timezone,
    fields,
    field,
    chooseField,
    days,
    date,
    chooseDate,
    status,
    retry,
    grid,
    tailLabel,
    selection,
    tap,
    notice,
    pickerFocusRef,
  } = useBooking();

  const showZone = timezone !== DEFAULT_TIMEZONE;
  const hasSlots = grid.day.length > 0;
  const hasFreeSlot = grid.day.some((slot) => slot.available);

  function timeButton(slot: GridSlot, overnight: boolean) {
    const time = formatZonedTime(slot.startsAt, timezone);
    const chosen =
      selection !== null &&
      slot.startMs >= selection.startMs &&
      slot.startMs < selection.endMs;
    const price = formatPrice(slot.priceCents);
    const peak = field !== undefined && isPeak(slot, field);
    // Past midnight the name carries the date: "00:00" alone would read as
    // tonight's midnight. It starts with the visible time.
    const base = overnight ? `${time}, ${tailLabel}` : time;
    const name = !slot.available
      ? `${base}, ocupado, ${price}`
      : `${base}, ${price}${peak ? ', nobre' : ''}, ${chosen ? 'selecionado' : 'livre'}`;
    return (
      <button
        key={slot.startsAt}
        type="button"
        disabled={!slot.available}
        aria-pressed={slot.available ? chosen : undefined}
        aria-label={name}
        onClick={() => {
          tap(slot.startMs);
        }}
        className={cn(
          TIME_BUTTON,
          !slot.available
            ? 'cursor-not-allowed border-surface bg-surface text-muted line-through'
            : chosen
              ? 'border-ink bg-ink text-white'
              : 'border-line-control bg-bg text-ink hover:border-ink',
        )}
      >
        <span className="font-mono text-[15px] font-semibold">{time}</span>
        <span
          className={cn(
            'text-xs',
            !slot.available
              ? 'text-muted'
              : chosen
                ? 'text-[#d9d9d9]'
                : peak
                  ? 'font-semibold text-peak'
                  : 'text-muted',
          )}
        >
          {slot.available ? `${price}${peak ? ' · nobre' : ''}` : 'Ocupado'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="-mt-3 mb-0.5 text-sm text-muted">
        Toque em horários seguidos para jogar mais tempo.
      </p>
      <div
        role="group"
        aria-label="Data"
        className="-mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1.5"
      >
        {days.map((day) => {
          const pressed = day.date === date;
          return (
            <button
              key={day.date}
              ref={pressed ? pickerFocusRef : undefined}
              type="button"
              aria-pressed={pressed}
              aria-label={day.ariaLabel}
              onClick={() => {
                chooseDate(day.date);
              }}
              className={cn(
                DAY_BUTTON,
                pressed
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-control bg-bg text-ink hover:border-ink',
              )}
            >
              <span className="text-xs font-semibold">{day.weekday}</span>
              <span className="text-xl font-[650]">{day.dayOfMonth}</span>
            </button>
          );
        })}
      </div>

      {fields.length > 1 ? (
        <Field label="Quadra">
          <Select
            value={field?.id ?? ''}
            options={fields.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={(event) => {
              chooseField(event.target.value);
            }}
          />
        </Field>
      ) : null}

      <fieldset className="min-w-0" aria-busy={status.state === 'loading'}>
        <legend className="sr-only">Horários</legend>
        {showZone ? (
          <p className="mb-2 text-sm text-muted">
            {`Horários de ${TIMEZONE_LABELS[timezone]}`}
          </p>
        ) : null}

        {status.state === 'loading' ? (
          <>
            <p role="status" className="sr-only">
              Carregando horários
            </p>
            <div className={TIME_GRID}>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-[60px] rounded-[12px]" />
              ))}
            </div>
          </>
        ) : status.state === 'error' ? null : !hasSlots ? (
          <p className="text-sm text-muted">O espaço não abre neste dia.</p>
        ) : (
          <>
            {hasFreeSlot ? null : (
              <p className="mb-2 text-sm text-muted">
                Nenhum horário livre neste dia.
              </p>
            )}
            <div className={TIME_GRID}>
              {grid.day.map((slot) => timeButton(slot, false))}
            </div>
            {grid.tail.length > 0 ? (
              <div
                role="group"
                aria-labelledby="madrugada-heading"
                className="mt-4"
              >
                <p
                  id="madrugada-heading"
                  className="mb-2 text-sm font-semibold text-ink"
                >
                  {`Madrugada de ${tailLabel}`}
                </p>
                <div className={TIME_GRID}>
                  {grid.tail.map((slot) => timeButton(slot, true))}
                </div>
              </div>
            ) : null}
          </>
        )}
        <p aria-live="polite" className={notice ? 'mt-2 text-sm text-ink' : ''}>
          {notice}
        </p>
      </fieldset>

      {/* Outside the "Horários" group: only times are buttons in there. */}
      <Alert tone="error">
        {status.state === 'error' ? status.message : ''}
      </Alert>
      {status.state === 'error' ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={retry}
          className="self-start"
        >
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
