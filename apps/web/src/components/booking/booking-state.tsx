'use client';

import type { Availability, BrazilTimezone } from '@arenaz/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  addDaysToDateKey,
  createBooking,
  DEFAULT_PLAYERS,
  fetchAvailability,
  longDateLabel,
  MAX_PLAYERS,
  MIN_PLAYERS,
  pickerDays,
  signInPathFor,
  whenLabel,
  withinHorizon,
  type BookingIntent,
  type PickerDay,
} from '@/lib/booking-client';
import { navigate } from '@/lib/navigate';
import { GENERIC_ERROR } from '@/lib/problem';
import {
  overnightTail,
  selectionTotalCents,
  selectSlot,
  type PickerSlot,
  type Selection,
} from '@/lib/slot-selection';
import {
  formatZonedRange,
  formatZonedTime,
  todayInZone,
  toZonedIso,
} from '@/lib/zoned-time';

export interface PickerField {
  id: string;
  name: string;
  minSlotMinutes: number;
  /** Base price: a time dearer than this is "nobre". */
  basePriceCentsPerHour: number;
}

/** A grid slot with the instants as the API wrote them. */
export interface GridSlot extends PickerSlot {
  startsAt: string;
}

export interface Grid {
  /** The day's own times. */
  day: GridSlot[];
  /** The early hours of the next day that continue the day's last opening. */
  tail: GridSlot[];
}

/** What the chosen stretch is, in words, for the card and the bar. */
export interface ChoiceSummary {
  fieldName: string;
  /** "Qui, 29 out": the day the stretch starts. */
  whenLabel: string;
  /** "20:00–22:00"; past midnight "23:00–01:00 (termina Sex, 30/10)". */
  timeRange: string;
  durationMinutes: number;
  totalCents: number;
}

type Loaded =
  | {
      key: string;
      ok: true;
      data: Availability;
      /** The day after, loaded when the day's opening runs to 24:00. */
      nextData?: Availability;
    }
  | { key: string; ok: false; message: string };

export type GridStatus =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready' };

const SLOT_TAKEN = 'Esse horário acabou de ser reservado. Escolha outro.';
const LOAD_ERROR = 'Não foi possível carregar os horários.';

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

/** 00:00 of the day after `date`, in the venue's zone. */
function midnightAfter(date: string, timezone: string): number {
  return Date.parse(toZonedIso(date, 24 * 60, timezone));
}

function toGrid(
  loaded: Extract<Loaded, { ok: true }> | null,
  fieldId: string,
  midnightMs: number,
): Grid {
  if (!loaded) return { day: [], tail: [] };
  // A time that already started cannot be booked: it is left out instead
  // of reading "Ocupado" (the API sends it as unavailable).
  const now = Date.now();
  const day = toGridSlots(loaded.data, fieldId).filter(
    (slot) => slot.available || slot.startMs > now,
  );
  const tail = overnightTail(
    day,
    toGridSlots(loaded.nextData, fieldId),
    midnightMs,
  );
  return { day, tail };
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

/** The minimum block starting at `time` ("HH:MM") of the day, if it is free. */
function selectionAt(
  day: readonly GridSlot[],
  time: string,
  timezone: string,
): Selection | null {
  const slot = day.find(
    (candidate) => formatZonedTime(candidate.startsAt, timezone) === time,
  );
  return slot?.available ? { startMs: slot.startMs, endMs: slot.endMs } : null;
}

/**
 * A time is "nobre" when its block costs more than the court's base price
 * would: each 30 minutes of the base price is `round(price / 2)`, as the
 * server prices it, so equal prices never read as dearer.
 */
export function isPeak(slot: PickerSlot, field: PickerField): boolean {
  const segments = (slot.endMs - slot.startMs) / (30 * 60_000);
  return (
    slot.priceCents > segments * Math.round(field.basePriceCentsPerHour / 2)
  );
}

function clampPlayers(count: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count));
}

export interface BookingState {
  timezone: BrazilTimezone;
  fields: PickerField[];
  field: PickerField | undefined;
  chooseField: (id: string) => void;
  days: PickerDay[];
  date: string;
  chooseDate: (date: string) => void;
  status: GridStatus;
  retry: () => void;
  grid: Grid;
  /** "sábado, 31 de outubro": the day the early hours belong to. */
  tailLabel: string;
  selection: Selection | null;
  tap: (startMs: number) => void;
  /** Why the last tap did not do what it looked like it would. */
  notice: string;
  choice: ChoiceSummary | null;
  players: number;
  setPlayers: (count: number) => void;
  split: boolean;
  setSplit: (on: boolean) => void;
  submitting: boolean;
  submitError: string;
  reserve: () => Promise<void>;
  /** Where "Escolher horário" sends the focus: the chosen day's button. */
  pickerFocusRef: RefObject<HTMLButtonElement | null>;
  focusPicker: () => void;
}

const BookingContext = createContext<BookingState | null>(null);

export function useBooking(): BookingState {
  const state = useContext(BookingContext);
  if (!state) throw new Error('useBooking fora de BookingProvider');
  return state;
}

export interface BookingProviderProps {
  slug: string;
  /** IANA zone of the venue: every time is shown in it. */
  timezone: BrazilTimezone;
  fields: PickerField[];
  signedIn: boolean;
  /** A choice made before signing in, restored when it is still free. */
  initial?: BookingIntent | undefined;
  /** `?data`: the day to open, when it is within the horizon. */
  initialDate?: string | undefined;
  /** `?hora` ("HH:MM"): the time to pick on that day, when it is free. */
  initialTime?: string | undefined;
  /** `?jogadores`: the group size, 2 to 30. */
  initialPlayers?: number | undefined;
  children: ReactNode;
}

/**
 * Everything the venue page's booking needs, shared by the picker (in the
 * page) and the booking card (the right column, or the bar on a phone): the
 * day, the court, the availability of that day, the chosen stretch, the group
 * size and the booking itself. All times are the venue's, whatever the
 * browser's zone.
 */
export function BookingProvider({
  slug,
  timezone,
  fields,
  signedIn,
  initial,
  initialDate,
  initialTime,
  initialPlayers,
  children,
}: BookingProviderProps) {
  const [today] = useState(() => todayInZone(timezone));

  // A saved choice only counts when its day is still on offer and its court
  // still exists. It wins over `?data`/`?hora`.
  const usableInitial =
    initial &&
    withinHorizon(today, initial.date) &&
    fields.some((field) => field.id === initial.fieldId)
      ? initial
      : undefined;
  const startDate =
    usableInitial?.date ??
    (initialDate !== undefined && withinHorizon(today, initialDate)
      ? initialDate
      : today);
  const days = useMemo(() => pickerDays(today, startDate), [today, startDate]);

  const [date, setDate] = useState(startDate);
  const [fieldId, setFieldId] = useState(
    usableInitial?.fieldId ?? fields[0]?.id ?? '',
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [players, setPlayersState] = useState(() =>
    clampPlayers(initialPlayers ?? DEFAULT_PLAYERS),
  );
  const [split, setSplit] = useState(true);
  const pickerFocusRef = useRef<HTMLButtonElement | null>(null);
  // The saved choice (or `?hora`) is applied once, to the first grid of its
  // day.
  const pendingInitial = useRef(usableInitial);
  const pendingTime = useRef(
    usableInitial === undefined && startDate === initialDate
      ? initialTime
      : undefined,
  );

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
    // A function: TypeScript would keep the first check's narrowing across the
    // second await.
    const aborted = () => controller.signal.aborted;
    void (async () => {
      const result = await fetchAvailability(slug, date, controller.signal);
      if (aborted()) return;
      if (!result.ok) {
        setLoaded({ key: requestKey, ok: false, message: result.message });
        return;
      }

      // An opening that runs to 24:00 goes on after midnight when the next
      // day opens at 00:00: that day is read too, to offer the early hours.
      let nextData: Availability | undefined;
      const midnight = midnightAfter(date, timezone);
      const runsToMidnight = result.data.fields.some((candidate) =>
        candidate.slots.some((slot) => Date.parse(slot.endsAt) >= midnight),
      );
      if (runsToMidnight) {
        const next = await fetchAvailability(
          slug,
          addDaysToDateKey(date, 1),
          controller.signal,
        );
        if (aborted()) return;
        // Without it the day still works; it just ends at 24:00.
        if (next.ok) nextData = next.data;
      }

      const ready: Extract<Loaded, { ok: true }> = {
        key: requestKey,
        ok: true,
        data: result.data,
        ...(nextData ? { nextData } : {}),
      };
      setLoaded(ready);
      const intent = pendingInitial.current;
      if (intent && intent.date === date) {
        pendingInitial.current = undefined;
        const initialGrid = toGrid(ready, intent.fieldId, midnight);
        setSelection(
          restoreSelection([...initialGrid.day, ...initialGrid.tail], intent),
        );
      }
      const time = pendingTime.current;
      if (time !== undefined) {
        pendingTime.current = undefined;
        setSelection(
          selectionAt(toGrid(ready, fieldId, midnight).day, time, timezone),
        );
      }
    })();
    return () => {
      controller.abort();
    };
    // `fieldId` only matters for `?hora`, applied to the first grid; a court
    // change never needs a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, date, requestKey, timezone]);

  const current = loaded?.key === requestKey ? loaded : null;
  const field = fields.find((candidate) => candidate.id === fieldId);
  const midnightMs = useMemo(
    () => midnightAfter(date, timezone),
    [date, timezone],
  );
  const grid = useMemo(
    () => toGrid(current?.ok ? current : null, fieldId, midnightMs),
    [current, fieldId, midnightMs],
  );
  const slots = useMemo(() => [...grid.day, ...grid.tail], [grid]);
  const tailLabel = longDateLabel(addDaysToDateKey(date, 1));
  const total = selection ? selectionTotalCents(slots, selection) : null;

  const choice = useMemo((): ChoiceSummary | null => {
    if (!selection || total === null || !field) return null;
    const startsAt = new Date(selection.startMs).toISOString();
    const endsAt = new Date(selection.endMs).toISOString();
    const startsAfterMidnight = selection.startMs >= midnightMs;
    const endsAfterMidnight = selection.endMs > midnightMs;
    const range = formatZonedRange(startsAt, endsAt, timezone);
    const nextDay = addDaysToDateKey(date, 1);
    return {
      fieldName: field.name,
      whenLabel: whenLabel(startsAfterMidnight ? nextDay : date),
      timeRange:
        endsAfterMidnight && !startsAfterMidnight
          ? `${range} (termina ${whenLabel(nextDay)})`
          : range,
      durationMinutes: (selection.endMs - selection.startMs) / 60_000,
      totalCents: total,
    };
  }, [selection, total, field, midnightMs, timezone, date]);

  const chooseDate = useCallback(
    (next: string) => {
      pendingInitial.current = undefined;
      pendingTime.current = undefined;
      if (next === date) return;
      setDate(next);
      setSelection(null);
      setNotice('');
      setSubmitError('');
    },
    [date],
  );

  const chooseField = useCallback((next: string) => {
    pendingInitial.current = undefined;
    pendingTime.current = undefined;
    setFieldId(next);
    setSelection(null);
    setNotice('');
    setSubmitError('');
  }, []);

  const tap = useCallback(
    (startMs: number) => {
      pendingInitial.current = undefined;
      pendingTime.current = undefined;
      const result = selectSlot(slots, selection, startMs);
      setSelection(result.selection);
      setNotice(result.message ?? '');
      setSubmitError('');
    },
    [slots, selection],
  );

  const retry = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  const setPlayers = useCallback((count: number) => {
    setPlayersState(clampPlayers(count));
  }, []);

  const focusPicker = useCallback(() => {
    const target = pickerFocusRef.current;
    if (!target) return;
    target.focus();
    target.scrollIntoView({ block: 'center' });
  }, []);

  const reserve = useCallback(async () => {
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
      navigate(signInPathFor(slug, intent, players));
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
      navigate(signInPathFor(slug, intent, players));
      return;
    }
    if (result.status === 409) {
      setSubmitError(SLOT_TAKEN);
      setSelection(null);
      retry();
      return;
    }
    setSubmitError(result.message);
  }, [
    selection,
    field,
    submitting,
    slots,
    date,
    signedIn,
    slug,
    players,
    retry,
  ]);

  const status: GridStatus =
    current === null
      ? { state: 'loading' }
      : current.ok
        ? { state: 'ready' }
        : { state: 'error', message: loadErrorText(current.message) };

  const value: BookingState = {
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
    choice,
    players,
    setPlayers,
    split,
    setSplit,
    submitting,
    submitError,
    reserve,
    pickerFocusRef,
    focusPicker,
  };

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}
