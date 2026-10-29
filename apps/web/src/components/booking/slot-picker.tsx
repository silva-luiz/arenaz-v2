'use client';

import {
  DEFAULT_TIMEZONE,
  TIMEZONE_LABELS,
  type Availability,
  type BrazilTimezone,
} from '@arenaz/contracts';
import {
  Alert,
  Button,
  Chip,
  cn,
  Field,
  FOCUS_RING,
  Select,
  Skeleton,
} from '@arenaz/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createBooking,
  dateChips,
  fetchAvailability,
  signInPathFor,
  type BookingIntent,
} from '@/lib/booking-client';
import { navigate } from '@/lib/navigate';
import { GENERIC_ERROR } from '@/lib/problem';
import {
  selectionTotalCents,
  selectSlot,
  type PickerSlot,
  type Selection,
} from '@/lib/slot-selection';
import {
  formatZonedRange,
  formatZonedTime,
  todayInZone,
} from '@/lib/zoned-time';
import { BookingSummary } from './booking-summary';

export interface PickerField {
  id: string;
  name: string;
  minSlotMinutes: number;
}

export interface SlotPickerProps {
  slug: string;
  /** IANA zone of the venue: every time is shown in it. */
  timezone: BrazilTimezone;
  fields: PickerField[];
  signedIn: boolean;
  /** A choice made before signing in, restored when it is still free. */
  initial?: BookingIntent | undefined;
}

/** A grid slot with the instants as the API wrote them. */
interface GridSlot extends PickerSlot {
  startsAt: string;
}

type Loaded =
  | { key: string; ok: true; data: Availability }
  | { key: string; ok: false; message: string };

const SLOT_TAKEN = 'Esse horário acabou de ser reservado. Escolha outro.';
const LOAD_ERROR = 'Não foi possível carregar os horários.';

const TIME_BUTTON = cn(
  'h-11 rounded-button border px-2 font-mono text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none',
  FOCUS_RING,
);

/** The API's own text for a refusal worth telling (429...), else ours. */
function loadErrorText(message: string): string {
  return message === GENERIC_ERROR ? LOAD_ERROR : message;
}

function toGridSlots(
  data: Availability | undefined,
  fieldId: string,
): GridSlot[] {
  const field = data?.fields.find((candidate) => candidate.id === fieldId);
  return (field?.slots ?? []).map((slot) => ({
    startsAt: slot.startsAt,
    startMs: Date.parse(slot.startsAt),
    endMs: Date.parse(slot.endsAt),
    available: slot.available,
    priceCents: slot.priceCents,
  }));
}

/** The chosen stretch when every block of it is still free; else `null`. */
function restoreSelection(
  slots: readonly GridSlot[],
  intent: BookingIntent,
): Selection | null {
  const startMs = Date.parse(intent.startsAt);
  const endMs = startMs + intent.durationMinutes * 60_000;
  const first = slots.find((slot) => slot.startMs === startMs);
  if (!first) return null;
  const block = first.endMs - first.startMs;
  if ((endMs - startMs) % block !== 0) return null;
  for (let at = startMs; at < endMs; at += block) {
    if (!slots.find((slot) => slot.startMs === at)?.available) return null;
  }
  return { startMs, endMs };
}

/**
 * Day, court and time of a booking, read from the public availability of the
 * venue. All times are the venue's, whatever the browser's zone.
 */
export function SlotPicker({
  slug,
  timezone,
  fields,
  signedIn,
  initial,
}: SlotPickerProps) {
  const [today] = useState(() => todayInZone(timezone));
  const chips = useMemo(() => dateChips(today), [today]);

  // A saved choice only counts when its day is still on offer and its court
  // still exists.
  const usableInitial =
    initial &&
    chips.some((chip) => chip.date === initial.date) &&
    fields.some((field) => field.id === initial.fieldId)
      ? initial
      : undefined;

  const [date, setDate] = useState(usableInitial?.date ?? today);
  const [fieldId, setFieldId] = useState(
    usableInitial?.fieldId ?? fields[0]?.id ?? '',
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // The saved choice is applied once, to the first grid of its day.
  const pendingInitial = useRef(usableInitial);

  const requestKey = `${date}#${String(reload)}`;

  // Coming back with the browser's back button can restore this page from the
  // back/forward cache with the "busy" state frozen in.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAvailability(slug, date, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoaded(
        result.ok
          ? { key: requestKey, ok: true, data: result.data }
          : { key: requestKey, ok: false, message: result.message },
      );
      const intent = pendingInitial.current;
      if (intent && result.ok && intent.date === date) {
        pendingInitial.current = undefined;
        setSelection(
          restoreSelection(toGridSlots(result.data, intent.fieldId), intent),
        );
      }
    });
    return () => {
      controller.abort();
    };
  }, [slug, date, requestKey]);

  const current = loaded?.key === requestKey ? loaded : null;
  const field = fields.find((candidate) => candidate.id === fieldId);
  const slots = useMemo(
    () => toGridSlots(current?.ok ? current.data : undefined, fieldId),
    [current, fieldId],
  );

  const total = selection ? selectionTotalCents(slots, selection) : null;
  const summary =
    selection && total !== null && field
      ? {
          fieldName: field.name,
          dayLabel: chips.find((chip) => chip.date === date)?.label ?? date,
          timeRange: formatZonedRange(
            new Date(selection.startMs).toISOString(),
            new Date(selection.endMs).toISOString(),
            timezone,
          ),
          totalCents: total,
        }
      : null;

  function chooseDate(next: string) {
    pendingInitial.current = undefined;
    if (next === date) return;
    setDate(next);
    setSelection(null);
    setNotice('');
    setSubmitError('');
  }

  function chooseField(next: string) {
    pendingInitial.current = undefined;
    setFieldId(next);
    setSelection(null);
    setNotice('');
    setSubmitError('');
  }

  function tap(startMs: number) {
    pendingInitial.current = undefined;
    const result = selectSlot(slots, selection, startMs);
    setSelection(result.selection);
    setNotice(result.message ?? '');
    setSubmitError('');
  }

  function retry() {
    setReload((value) => value + 1);
  }

  async function reserve() {
    if (!selection || !field || submitting) return;
    const first = slots.find((slot) => slot.startMs === selection.startMs);
    if (!first) return;
    const intent: BookingIntent = {
      date,
      fieldId: field.id,
      startsAt: first.startsAt,
      durationMinutes: (selection.endMs - selection.startMs) / 60_000,
    };

    if (!signedIn) {
      navigate(signInPathFor(slug, intent));
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    const result = await createBooking({
      fieldId: intent.fieldId,
      startsAt: intent.startsAt,
      durationMinutes: intent.durationMinutes,
    });
    if (result.ok) {
      // Stays "busy" until the page changes.
      navigate(`/reservas/${result.data.id}`);
      return;
    }
    setSubmitting(false);
    if (result.status === 401) {
      // The API client already sent the person to sign in, but only back to
      // this path; this link also brings the choice back.
      navigate(signInPathFor(slug, intent));
      return;
    }
    if (result.status === 409) {
      setSubmitError(SLOT_TAKEN);
      setSelection(null);
      retry();
      return;
    }
    setSubmitError(result.message);
  }

  const showZone = timezone !== DEFAULT_TIMEZONE;
  const hasSlots = slots.length > 0;
  const hasFreeSlot = slots.some((slot) => slot.available);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Data"
        className="-mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1"
      >
        {chips.map((chip) => (
          <Chip
            key={chip.date}
            pressed={chip.date === date}
            aria-label={chip.ariaLabel}
            onClick={() => {
              chooseDate(chip.date);
            }}
            className="shrink-0"
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {fields.length > 1 ? (
        <Field label="Quadra">
          <Select
            value={fieldId}
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

      <fieldset className="min-w-0" aria-busy={current === null}>
        <legend className="mb-2 text-sm font-medium text-ink">Horários</legend>
        {showZone ? (
          <p className="mb-2 text-sm text-muted">
            {`Horários de ${TIMEZONE_LABELS[timezone]}`}
          </p>
        ) : null}

        {current === null ? (
          <>
            <p role="status" className="sr-only">
              Carregando horários
            </p>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-11 rounded-button" />
              ))}
            </div>
          </>
        ) : !current.ok ? (
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        ) : !hasSlots ? (
          <p className="text-sm text-muted">O espaço não abre neste dia.</p>
        ) : (
          <>
            {hasFreeSlot ? null : (
              <p className="mb-2 text-sm text-muted">
                Nenhum horário livre neste dia.
              </p>
            )}
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => {
                const time = formatZonedTime(slot.startsAt, timezone);
                const inSelection =
                  selection !== null &&
                  slot.startMs >= selection.startMs &&
                  slot.startMs < selection.endMs;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={slot.available ? inSelection : undefined}
                    aria-label={
                      slot.available ? undefined : `${time}, indisponível`
                    }
                    onClick={() => {
                      tap(slot.startMs);
                    }}
                    className={cn(
                      TIME_BUTTON,
                      inSelection
                        ? 'border-ink bg-ink text-white'
                        : 'border-line-control bg-bg text-ink enabled:hover:bg-surface',
                      'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-muted disabled:line-through',
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-muted">
              Toque em horários seguidos para jogar mais tempo.
            </p>
          </>
        )}
        <p aria-live="polite" className={notice ? 'mt-2 text-sm text-ink' : ''}>
          {notice}
        </p>
      </fieldset>

      {/* Sticks to the bottom of the sheet (or card) when the grid is taller
          than the space, so the total and "Reservar" are always in view. */}
      <div className="sticky bottom-0 -mx-1 flex flex-col gap-4 bg-bg px-1 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <BookingSummary selection={summary} />

        <Alert tone="error">
          {current?.ok === false ? loadErrorText(current.message) : submitError}
        </Alert>

        <Button
          size="md"
          loading={submitting}
          disabled={selection === null || total === null}
          onClick={() => {
            void reserve();
          }}
          className="w-full"
        >
          Reservar
        </Button>
      </div>
    </div>
  );
}
