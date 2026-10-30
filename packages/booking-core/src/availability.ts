import { priceSegments, type PriceRule, type PriceSegment } from './pricing.js';
import {
  MINUTES_PER_DAY,
  SLOT_MINUTES,
  SLOT_MS,
  addDays,
  localDateOf,
  localDayRange,
  toInstant,
  weekdayOfDate,
} from './time.js';

export interface Interval {
  start: Date;
  end: Date;
}

export interface HoursRow {
  /** 0 = Sunday. */
  weekday: number;
  openMinute: number;
  closeMinute: number;
}

export interface FieldRules {
  minSlotMinutes: number;
  basePriceCentsPerHour: number;
}

export type BookingErrorCode =
  | 'past'
  | 'misaligned'
  | 'too_short'
  | 'closed'
  | 'too_far'
  | 'busy';

export const DEFAULT_HORIZON_DAYS = 60;
/** A 24h venue could chain forever; stop after a week of consecutive days. */
const MAX_CHAIN_DAYS = 7;

/** Rows of the weekday; invalid rows (out of range or open >= close) are dropped silently. */
function dayRows(hours: readonly HoursRow[], date: string): HoursRow[] {
  const weekday = weekdayOfDate(date);
  return hours
    .filter(
      (r) =>
        r.weekday === weekday &&
        r.openMinute >= 0 &&
        r.closeMinute <= MINUTES_PER_DAY &&
        r.openMinute < r.closeMinute,
    )
    .sort((a, b) => a.openMinute - b.openMinute);
}

/** Minute-of-day intervals of one date, sorted, touching/overlapping ones merged. */
function mergedMinutes(
  hours: readonly HoursRow[],
  date: string,
): [number, number][] {
  const out: [number, number][] = [];
  for (const r of dayRows(hours, date)) {
    const last = out.at(-1);
    if (last && r.openMinute <= last[1]) {
      last[1] = Math.max(last[1], r.closeMinute);
    } else {
      out.push([r.openMinute, r.closeMinute]);
    }
  }
  return out;
}

/**
 * Opening intervals of local `date`. Touching or overlapping intervals are
 * merged, and an interval ending at 24:00 is joined with the following day
 * interval starting at 00:00 (so a booking may cross midnight).
 */
export function openWindows(
  date: string,
  tz: string,
  hours: readonly HoursRow[],
): Interval[] {
  const minutes = mergedMinutes(hours, date);
  const windows = minutes.map(([open, close]) => ({
    start: toInstant(date, open, tz),
    end: toInstant(date, close, tz),
  }));
  const tail = minutes.at(-1);
  const tailWindow = windows.at(-1);
  if (tail && tailWindow && tail[1] === MINUTES_PER_DAY) {
    let day = date;
    for (let i = 0; i < MAX_CHAIN_DAYS; i++) {
      day = addDays(day, 1);
      const first = mergedMinutes(hours, day)[0];
      if (!first || first[0] !== 0) break;
      tailWindow.end = toInstant(day, first[1], tz);
      if (first[1] !== MINUTES_PER_DAY) break;
    }
  }
  return windows;
}

const overlaps = (a: Interval, b: Interval) =>
  a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();

function fitsWindow(windows: readonly Interval[], block: Interval): boolean {
  return windows.some(
    (w) =>
      w.start.getTime() <= block.start.getTime() &&
      block.end.getTime() <= w.end.getTime(),
  );
}

/** Last bookable local date: today in the venue zone + horizonDays (inclusive). */
const horizonDate = (now: Date, tz: string, horizonDays: number | undefined) =>
  addDays(localDateOf(now, tz), horizonDays ?? DEFAULT_HORIZON_DAYS);

export interface DaySlot {
  startsAt: Date;
  /** End of the minimum block starting at `startsAt`. */
  endsAt: Date;
  available: boolean;
  /** Price of the minimum block. */
  priceCents: number;
}

export interface DaySlotsInput {
  date: string;
  tz: string;
  now: Date;
  hours: readonly HoursRow[];
  field: FieldRules;
  rules: readonly PriceRule[];
  /** Blocks and active (held/confirmed) bookings of the field. */
  busy: readonly Interval[];
  horizonDays?: number;
}

export function daySlots(input: DaySlotsInput): DaySlot[] {
  const { date, tz, now, hours, field, rules, busy } = input;
  const lastDate = horizonDate(now, tz, input.horizonDays);
  const dayEnd = localDayRange(date, tz).end.getTime();
  const windows = openWindows(date, tz, hours);
  const blockMs = Math.max(field.minSlotMinutes, SLOT_MINUTES) * 60_000;
  const slots: DaySlot[] = [];
  for (const w of windows) {
    for (
      let t = w.start.getTime();
      t < w.end.getTime() && t < dayEnd;
      t += SLOT_MS
    ) {
      const block = { start: new Date(t), end: new Date(t + blockMs) };
      const available =
        t >= now.getTime() &&
        date <= lastDate &&
        fitsWindow(windows, block) &&
        !busy.some((b) => overlaps(b, block));
      slots.push({
        startsAt: block.start,
        endsAt: block.end,
        available,
        priceCents: priceSegments(
          block.start,
          block.end,
          tz,
          field.basePriceCentsPerHour,
          rules,
        ).reduce((sum, s) => sum + s.priceCents, 0),
      });
    }
  }
  return slots;
}

export interface ValidateBookingInput {
  start: Date;
  durationMinutes: number;
  tz: string;
  now: Date;
  hours: readonly HoursRow[];
  field: FieldRules;
  rules: readonly PriceRule[];
  busy: readonly Interval[];
  horizonDays?: number;
}

export type ValidateBookingResult =
  | { ok: true; segments: PriceSegment[]; totalCents: number }
  | { ok: false; code: BookingErrorCode };

const fail = (code: BookingErrorCode): ValidateBookingResult => ({
  ok: false,
  code,
});

export function validateBooking(
  input: ValidateBookingInput,
): ValidateBookingResult {
  const { start, durationMinutes, tz, now, hours, field, rules, busy } = input;
  const t = start.getTime();
  // Alignment is checked on the epoch: valid because every Brazilian zone has a whole-30-minute offset.
  if (
    Number.isNaN(t) ||
    t % SLOT_MS !== 0 ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes % SLOT_MINUTES !== 0
  ) {
    return fail('misaligned');
  }
  if (durationMinutes < Math.max(field.minSlotMinutes, SLOT_MINUTES)) {
    return fail('too_short');
  }
  if (t < now.getTime()) return fail('past');
  if (localDateOf(start, tz) > horizonDate(now, tz, input.horizonDays)) {
    return fail('too_far');
  }

  const block = { start, end: new Date(t + durationMinutes * 60_000) };
  const windows = openWindows(localDateOf(start, tz), tz, hours);
  if (!fitsWindow(windows, block)) return fail('closed');
  if (busy.some((b) => overlaps(b, block))) return fail('busy');

  const segments = priceSegments(
    block.start,
    block.end,
    tz,
    field.basePriceCentsPerHour,
    rules,
  );
  return {
    ok: true,
    segments,
    totalCents: segments.reduce((sum, s) => sum + s.priceCents, 0),
  };
}
