import type { AgendaItem, Venue } from '@arenaz/contracts';
import { formatMinute } from './format-br';
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

/** One header of the agenda's time axis: the hour over its 30-minute columns. */
export interface HourGroup {
  /** First column of the group (minute of the day). */
  minute: number;
  /** "16h", or "16:30" when the group starts on the half hour. */
  label: string;
  /** Number of 30-minute columns under it (1 or 2). */
  span: number;
}

/**
 * The hour headers over the columns of `agendaRowMinutes`: consecutive
 * columns of the same hour share one header; a gap in the opening hours
 * starts a new one.
 */
export function hourGroups(columns: readonly number[]): HourGroup[] {
  const groups: HourGroup[] = [];
  let previous: number | undefined;
  for (const minute of columns) {
    const last = groups.at(-1);
    const sameHour =
      last !== undefined &&
      previous === minute - STEP &&
      Math.floor(previous / 60) === Math.floor(minute / 60);
    if (sameHour) {
      last.span += 1;
    } else {
      groups.push({
        minute,
        label:
          minute % 60 === 0 ? `${String(minute / 60)}h` : formatMinute(minute),
        span: 1,
      });
    }
    previous = minute;
  }
  return groups;
}

export interface AgendaGridModel {
  /** `cells[row][column]` */
  cells: GridCell[][];
  /** Per column: items that cannot sit at their true rows (see below). */
  overflow: PlacedItem[][];
}

/**
 * The cells of the court × time table. An item is drawn only where it truly
 * is: it must start on a row, end on a row boundary and not share a row with
 * an item already placed in that court. Anything else (overlaps, odd
 * minutes) is never moved or clipped: it goes to the court's `overflow` and
 * the view lists it under the table.
 */
export function buildAgendaGrid(
  fields: { items: AgendaItem[] }[],
  rows: number[],
  date: string,
  timeZone: string,
): AgendaGridModel {
  const cells: GridCell[][] = rows.map(() =>
    fields.map((): GridCell => ({ kind: 'empty' })),
  );
  const overflow: PlacedItem[][] = fields.map(() => []);

  fields.forEach((field, column) => {
    const placed = field.items
      .map((item) => placeItem(item, date, timeZone))
      .sort(
        (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
      );
    for (const entry of placed) {
      const first = rows.indexOf(entry.startMinute);
      let last = rows.indexOf(entry.endMinute - STEP);
      const aligned =
        first !== -1 &&
        last >= first &&
        entry.endMinute > entry.startMinute &&
        rows[last] === entry.endMinute - STEP &&
        // contiguous rows: nothing missing in between
        last - first === (entry.endMinute - entry.startMinute) / STEP - 1;
      let free = aligned;
      if (aligned) {
        for (let row = first; row <= last; row += 1) {
          if (cells[row]?.[column]?.kind !== 'empty') free = false;
        }
      }
      if (!free) {
        overflow[column]?.push(entry);
        continue;
      }
      last = Math.max(last, first);
      const cell = cells[first];
      if (cell)
        cell[column] = { kind: 'item', placed: entry, span: last - first + 1 };
      for (let row = first + 1; row <= last; row += 1) {
        const covered = cells[row];
        if (covered) covered[column] = { kind: 'covered' };
      }
    }
  });

  return { cells, overflow };
}

/** "confirmada" / "aguardando pagamento" for a booking in the agenda. */
export function bookingStatusLabel(status: string): string {
  return status === 'held' ? 'aguardando pagamento' : 'confirmada';
}

/**
 * What a screen reader says for an agenda button. The visible texts (name or
 * "Bloqueio", the time range, "Pelo app"/"Manual"/"Aguardando pagamento"/the
 * reason) all appear in it, so the visible label is part of the name.
 */
export function itemAriaLabel(
  item: AgendaItem,
  fieldName: string,
  timeZone: string,
): string {
  const range = formatZonedRange(item.startsAt, item.endsAt, timeZone);
  if (item.kind === 'block') {
    return `${fieldName}, ${range}, bloqueio, ${item.reason ?? 'sem motivo'}`;
  }
  const origin = item.origin === 'app' ? 'pelo app' : 'manual';
  return `${fieldName}, ${range}, reserva de ${item.customerName}, ${origin}, ${bookingStatusLabel(item.status)}`;
}
