import { TZDate } from '@date-fns/tz';

export const MINUTES_PER_DAY = 1440;
export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60_000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/**
 * Wall-clock `minuteOfDay` (0-1440) of local `date` in `tz` as an instant.
 * 1440 is 00:00 of the next day. A wall time skipped by a historical DST
 * jump resolves to the first instant after the jump.
 */
export function toInstant(date: string, minuteOfDay: number, tz: string): Date {
  const [y, mo, d] = parseDate(date);
  return new Date(new TZDate(y, mo - 1, d, 0, minuteOfDay, 0, 0, tz).getTime());
}

/** [00:00, next day 00:00) of local `date` in `tz`. */
export function localDayRange(
  date: string,
  tz: string,
): { start: Date; end: Date } {
  return {
    start: toInstant(date, 0, tz),
    end: toInstant(date, MINUTES_PER_DAY, tz),
  };
}

/** Local calendar date (YYYY-MM-DD) of an instant in `tz`. */
export function localDateOf(instant: Date, tz: string): string {
  const z = TZDate.tz(tz, instant.getTime());
  return `${pad(z.getFullYear(), 4)}-${pad(z.getMonth() + 1, 2)}-${pad(z.getDate(), 2)}`;
}

/** Local minute of the day (0-1439) of an instant in `tz`. */
export function localMinuteOf(instant: Date, tz: string): number {
  const z = TZDate.tz(tz, instant.getTime());
  return z.getHours() * 60 + z.getMinutes();
}

/** Local weekday of an instant in `tz` (0 = Sunday). */
export function localWeekdayOf(instant: Date, tz: string): number {
  return TZDate.tz(tz, instant.getTime()).getDay();
}

/** Weekday (0 = Sunday) of a calendar date; zone independent. */
export function weekdayOfDate(date: string): number {
  const [y, mo, d] = parseDate(date);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Calendar date `days` after `date` (zone independent). */
export function addDays(date: string, days: number): string {
  const [y, mo, d] = parseDate(date);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1, 2)}-${pad(t.getUTCDate(), 2)}`;
}
