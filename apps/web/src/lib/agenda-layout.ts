import type { AgendaItem, Venue } from '@arenaz/contracts';
import { formatZonedRange, toZonedIso } from './zoned-time';

const STEP = 30;
const DAY_MINUTES = 24 * 60;
const MS_PER_MINUTE = 60_000;

/** An agenda item on one day, in minutes since 00:00 of that day (venue zone). */
export interface PlacedItem {
  item: AgendaItem;
  startMinute: number;
  endMinute: number;
}

export type GridCell =
  | { kind: 'empty' }
  /** Taken by an item that started in a row above (rowSpan). */
  | { kind: 'covered' }
  | { kind: 'item'; placed: PlacedItem; span: number };

/** Weekday of a "YYYY-MM-DD" calendar date, 0 = Sunday. */
export function weekdayOf(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getUTCDay();
}

function minutesSinceDayStart(
  instant: string,
  date: string,
  timeZone: string,
): number {
  const dayStart = Date.parse(toZonedIso(date, 0, timeZone));
  return Math.round((Date.parse(instant) - dayStart) / MS_PER_MINUTE);
}

/**
 * Where an item falls on `date`, read on the wall clock of the venue's zone
 * and clipped to the day (the tail of an overnight booking starts at 00:00,
 * the head ends at 24:00).
 */
export function placeItem(
  item: AgendaItem,
  date: string,
  timeZone: string,
): PlacedItem {
  const start = minutesSinceDayStart(item.startsAt, date, timeZone);
  const end = minutesSinceDayStart(item.endsAt, date, timeZone);
  return {
    item,
    startMinute: Math.max(0, Math.min(DAY_MINUTES, start)),
    endMinute: Math.max(0, Math.min(DAY_MINUTES, end)),
  };
}

/**
 * Start minute of every 30-minute row of the grid: the opening hours of the
 * weekday plus whatever an item covers outside them (a block or a booking
 * made before the hours changed must never disappear).
 */
export function agendaRowMinutes(
  hours: Venue['hours'],
  date: string,
  placed: PlacedItem[],
): number[] {
  const rows = new Set<number>();
  const weekday = weekdayOf(date);
  for (const hour of hours) {
    if (hour.weekday !== weekday) continue;
    for (
      let minute = hour.openMinute;
      minute < hour.closeMinute;
      minute += STEP
    ) {
      rows.add(minute);
    }
  }
  for (const { startMinute, endMinute } of placed) {
    const first = Math.floor(startMinute / STEP) * STEP;
    for (let minute = first; minute < endMinute; minute += STEP)
      rows.add(minute);
  }
  return [...rows].sort((a, b) => a - b);
}

/**
 * The cells of the court × time table: `grid[row][column]`. An item sits in
 * its first row with a row span; the rows below are `covered`. An item that
 * starts inside the previous one of the same court is clipped to start after
 * it (it still shows in the phone list).
 */
export function buildAgendaGrid(
  fields: { items: AgendaItem[] }[],
  rows: number[],
  date: string,
  timeZone: string,
): GridCell[][] {
  const grid: GridCell[][] = rows.map(() =>
    fields.map((): GridCell => ({ kind: 'empty' })),
  );

  fields.forEach((field, column) => {
    const placed = field.items
      .map((item) => placeItem(item, date, timeZone))
      .sort((a, b) => a.startMinute - b.startMinute);
    let taken = -1; // last row index already used in this column
    for (const entry of placed) {
      let first = rows.findIndex((minute) => minute + STEP > entry.startMinute);
      if (first === -1) continue;
      first = Math.max(first, taken + 1);
      let last = first;
      while (
        rows[last + 1] !== undefined &&
        (rows[last + 1] ?? 0) < entry.endMinute
      ) {
        last += 1;
      }
      if ((rows[first] ?? 0) >= entry.endMinute) continue;
      const cell = grid[first];
      if (!cell) continue;
      cell[column] = { kind: 'item', placed: entry, span: last - first + 1 };
      for (let row = first + 1; row <= last; row += 1) {
        const covered = grid[row];
        if (covered) covered[column] = { kind: 'covered' };
      }
      taken = last;
    }
  });

  return grid;
}

/** "confirmada" / "aguardando pagamento" for a booking in the agenda. */
export function bookingStatusLabel(status: string): string {
  return status === 'held' ? 'aguardando pagamento' : 'confirmada';
}

/** What a screen reader says for an agenda button. */
export function itemAriaLabel(item: AgendaItem, timeZone: string): string {
  const range = formatZonedRange(item.startsAt, item.endsAt, timeZone);
  if (item.kind === 'block') {
    return `Bloqueio, ${range}${item.reason ? `, ${item.reason}` : ''}`;
  }
  return `Reserva de ${item.customerName}, ${range}, ${bookingStatusLabel(item.status)}`;
}
