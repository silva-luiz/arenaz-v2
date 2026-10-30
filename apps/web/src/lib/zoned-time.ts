import { formatMinute } from './format-br';

const MS_PER_MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

// One formatter per zone: building an Intl.DateTimeFormat is the costly part.
const offsetFormats = new Map<string, Intl.DateTimeFormat>();
const partsFormats = new Map<string, Intl.DateTimeFormat>();

function offsetFormat(timeZone: string): Intl.DateTimeFormat {
  let format = offsetFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    offsetFormats.set(timeZone, format);
  }
  return format;
}

function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let format = partsFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    partsFormats.set(timeZone, format);
  }
  return format;
}

/**
 * Offset of the zone at that instant, in minutes east of UTC (-180 in São
 * Paulo).
 */
function offsetMinutesAt(instantMs: number, timeZone: string): number {
  const name =
    offsetFormat(timeZone)
      .formatToParts(new Date(instantMs))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  // Very old dates carry the pre-1914 local mean time, with seconds
  // ("GMT-03:06:28"); they are rounded to the minute.
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/.exec(
    name,
  );
  if (!match) throw new Error(`Fuso inesperado: ${name}`);
  const [, sign, hours = '0', minutes = '0', seconds = '0'] = match;
  const total = Math.round(
    Number(hours) * 60 + Number(minutes) + Number(seconds) / 60,
  );
  return sign === '-' ? -total : total;
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * ISO 8601 timestamp, with the offset of THAT date in `timeZone` (an IANA
 * name, the venue's), for a wall-clock time there. `date` is "YYYY-MM-DD";
 * `minuteOfDay` runs 0–1440 and 1440 ("24:00") rolls over to 00:00 of the next
 * day.
 *
 * The offset comes from Intl, not from a constant: Brazil observed daylight
 * saving time until 2019, so old dates are -02:00 for part of the year.
 */
export function toZonedIso(
  date: string,
  minuteOfDay: number,
  timeZone: string,
): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  // Wall clock read as if it were UTC; also normalizes the day roll-over.
  // setUTCFullYear, not Date.UTC: the latter maps years 0-99 to 1900-1999.
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(0, minuteOfDay, 0, 0);
  const wallMs = wall.getTime();

  // Guess with the usual offset, then check it against the guessed instant;
  // the second pass settles dates next to an offset change.
  let offset = offsetMinutesAt(wallMs + 3 * 60 * MS_PER_MINUTE, timeZone);
  offset = offsetMinutesAt(wallMs - offset * MS_PER_MINUTE, timeZone);

  return (
    `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${formatOffset(offset)}`
  );
}

/**
 * Today's date in `timeZone`, "YYYY-MM-DD" (in the evening UTC is already
 * tomorrow).
 */
export function todayInZone(timeZone: string): string {
  const parts = Object.fromEntries(
    partsFormat(timeZone)
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  ) as Record<string, string | undefined>;
  return `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''}`;
}

interface WallClock {
  weekday: string;
  /** "31/10" */
  dayMonth: string;
  /** "2026-10-31", sortable and comparable */
  dateKey: string;
  minuteOfDay: number;
}

function wallClock(instant: string, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    partsFormat(timeZone)
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  ) as Record<string, string | undefined>;
  const weekday = (parts.weekday ?? '').replace('.', '');
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    dayMonth: `${parts.day ?? ''}/${parts.month ?? ''}`,
    dateKey: `${parts.year ?? ''}-${parts.month ?? ''}-${parts.day ?? ''}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function nextDayKey(dateKey: string, timeZone: string): string {
  return toZonedIso(dateKey, DAY_MINUTES, timeZone).slice(0, 10);
}

/**
 * "Sáb, 31/10 das 18:00 às 22:00 — Manutenção", in the time of `timeZone`. An
 * end at midnight of the following day reads "24:00"; a longer block names
 * both days.
 */
export function formatBlockRange(
  startsAt: string,
  endsAt: string,
  reason: string | null,
  timeZone: string,
): string {
  const start = wallClock(startsAt, timeZone);
  const end = wallClock(endsAt, timeZone);
  const suffix = reason ? ` — ${reason}` : '';
  const head = `${start.weekday}, ${start.dayMonth}`;

  if (end.dateKey === start.dateKey) {
    return `${head} das ${formatMinute(start.minuteOfDay)} às ${formatMinute(end.minuteOfDay)}${suffix}`;
  }
  if (
    end.minuteOfDay === 0 &&
    end.dateKey === nextDayKey(start.dateKey, timeZone)
  ) {
    return `${head} das ${formatMinute(start.minuteOfDay)} às 24:00${suffix}`;
  }
  return `${head} ${formatMinute(start.minuteOfDay)} até ${end.weekday}, ${end.dayMonth} ${formatMinute(end.minuteOfDay)}${suffix}`;
}

/** "18:00": the time of an instant on the wall clocks of `timeZone`. */
export function formatZonedTime(instant: string, timeZone: string): string {
  return formatMinute(wallClock(instant, timeZone).minuteOfDay);
}

/**
 * "18:00–19:30" in the time of `timeZone`. An end at midnight of the next day
 * reads "24:00", as in `formatBlockRange`.
 */
export function formatZonedRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string {
  const start = wallClock(startsAt, timeZone);
  const end = wallClock(endsAt, timeZone);
  const endText =
    end.minuteOfDay === 0 && end.dateKey !== start.dateKey
      ? '24:00'
      : formatMinute(end.minuteOfDay);
  return `${formatMinute(start.minuteOfDay)}–${endText}`;
}

/** "Seg, 02/11": the weekday and date of an instant in `timeZone`. */
export function formatZonedDay(instant: string, timeZone: string): string {
  const clock = wallClock(instant, timeZone);
  return `${clock.weekday}, ${clock.dayMonth}`;
}

/** "2026-11-02": the calendar day of an instant on the wall clocks of `timeZone`. */
export function zonedDateKey(instant: string, timeZone: string): string {
  return wallClock(instant, timeZone).dateKey;
}
