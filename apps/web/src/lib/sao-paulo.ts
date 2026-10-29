import { formatMinute } from './format-br';

const TIME_ZONE = 'America/Sao_Paulo';
const MS_PER_MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

const offsetFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  timeZoneName: 'longOffset',
});

const partsFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Offset of São Paulo at that instant, in minutes east of UTC (-180 usually). */
function offsetMinutesAt(instantMs: number): number {
  const name =
    offsetFormat
      .formatToParts(new Date(instantMs))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name);
  if (!match) throw new Error(`Fuso inesperado: ${name}`);
  const [, sign, hours = '0', minutes = '0'] = match;
  const total = Number(hours) * 60 + Number(minutes);
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
 * ISO 8601 timestamp, with the São Paulo offset of THAT date, for a wall-clock
 * time in São Paulo. `date` is "YYYY-MM-DD"; `minuteOfDay` runs 0–1440 and
 * 1440 ("24:00") rolls over to 00:00 of the next day.
 *
 * The offset comes from Intl, not from a constant: Brazil observed daylight
 * saving time until 2019, so old dates are -02:00 for part of the year.
 */
export function toSaoPauloIso(date: string, minuteOfDay: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  // Wall clock read as if it were UTC; also normalizes the day roll-over.
  const wall = new Date(Date.UTC(year, month - 1, day, 0, minuteOfDay, 0, 0));
  const wallMs = wall.getTime();

  // Guess with the usual offset, then check it against the guessed instant;
  // the second pass settles dates next to an offset change.
  let offset = offsetMinutesAt(wallMs + 3 * 60 * MS_PER_MINUTE);
  offset = offsetMinutesAt(wallMs - offset * MS_PER_MINUTE);

  return (
    `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00${formatOffset(offset)}`
  );
}

interface WallClock {
  weekday: string;
  /** "31/10" */
  dayMonth: string;
  /** "2026-10-31", sortable and comparable */
  dateKey: string;
  minuteOfDay: number;
}

function wallClock(instant: string): WallClock {
  const parts = Object.fromEntries(
    partsFormat
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

function nextDayKey(dateKey: string): string {
  return toSaoPauloIso(dateKey, DAY_MINUTES).slice(0, 10);
}

/**
 * "Sáb, 31/10 das 18:00 às 22:00 — Manutenção", in São Paulo time. An end at
 * midnight of the following day reads "24:00"; a longer block names both days.
 */
export function formatBlockRange(
  startsAt: string,
  endsAt: string,
  reason: string | null,
): string {
  const start = wallClock(startsAt);
  const end = wallClock(endsAt);
  const suffix = reason ? ` — ${reason}` : '';
  const head = `${start.weekday}, ${start.dayMonth}`;

  if (end.dateKey === start.dateKey) {
    return `${head} das ${formatMinute(start.minuteOfDay)} às ${formatMinute(end.minuteOfDay)}${suffix}`;
  }
  if (end.minuteOfDay === 0 && end.dateKey === nextDayKey(start.dateKey)) {
    return `${head} das ${formatMinute(start.minuteOfDay)} às 24:00${suffix}`;
  }
  return `${head} ${formatMinute(start.minuteOfDay)} até ${end.weekday}, ${end.dayMonth} ${formatMinute(end.minuteOfDay)}${suffix}`;
}
