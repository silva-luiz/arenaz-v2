import {
  addDays,
  localDateOf,
  localMinuteOf,
  localWeekdayOf,
} from '@arenaz/booking-core';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** "20h", "19h30". */
function hourText(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return minutes === 0
    ? `${String(hours)}h`
    : `${String(hours)}h${String(minutes).padStart(2, '0')}`;
}

/** "Hoje", "Amanhã" or "Sáb, 31 out", on the calendar of `timeZone`. */
function dayText(startsAt: Date, timeZone: string, now: Date): string {
  const day = localDateOf(startsAt, timeZone);
  const today = localDateOf(now, timeZone);
  if (day === today) return 'Hoje';
  if (day === addDays(today, 1)) return 'Amanhã';
  const [, month, date] = day.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return `${WEEKDAYS[localWeekdayOf(startsAt, timeZone)] ?? ''}, ${String(date)} ${MONTHS[month - 1] ?? ''}`;
}

/**
 * The line under the venue name on the hero card, in the venue's own time:
 * "Hoje · 20h às 22h · Quadra 2". An end at midnight of the next day reads
 * "24h".
 */
export function formatNextBookingWhen(
  startsAt: Date,
  endsAt: Date,
  fieldName: string,
  timeZone: string,
  now: Date,
): string {
  const endMinute = localMinuteOf(endsAt, timeZone);
  const endsAtMidnight =
    endMinute === 0 &&
    localDateOf(endsAt, timeZone) ===
      addDays(localDateOf(startsAt, timeZone), 1);
  const end = endsAtMidnight ? '24h' : hourText(endMinute);
  const start = hourText(localMinuteOf(startsAt, timeZone));
  return `${dayText(startsAt, timeZone, now)} · ${start} às ${end} · ${fieldName}`;
}

/** "#AZ-3F0C": the short booking code shown on the hero card. */
export function bookingCode(bookingId: string): string {
  return `#AZ-${bookingId.slice(0, 4).toUpperCase()}`;
}
