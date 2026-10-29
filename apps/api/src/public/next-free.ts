import {
  daySlots,
  localDateOf,
  localDayRange,
  localMinuteOf,
  type HoursRow,
  type Interval,
} from '@arenaz/booking-core';
import type { Db } from '@arenaz/db';
import { loadBusy } from '../booking/busy.js';

const DAY_MS = 86_400_000;

/** What the "next free time" of a venue needs: its zone, hours and active fields. */
export interface NextFreeVenue {
  id: string;
  timezone: string;
  hours: readonly HoursRow[];
  fields: readonly { id: string; minSlotMinutes: number }[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * "HH:MM" (venue wall clock) of the first slot still free today, on any of the
 * venue's active fields, or `null` when none is. Same slot rule as the public
 * availability (`daySlots`): 30 minute grid, never in the past, the field's
 * minimum block must fit inside the opening hours and miss every busy
 * interval. Only the venue's local date of `now` counts, so a slot after
 * midnight does not.
 */
export function nextFreeTime(
  venue: NextFreeVenue,
  busyByField: ReadonlyMap<string, readonly Interval[]>,
  now: Date,
): string | null {
  const date = localDateOf(now, venue.timezone);
  let earliest: Date | null = null;
  for (const item of venue.fields) {
    const free = daySlots({
      date,
      tz: venue.timezone,
      now,
      hours: venue.hours,
      // Prices are not needed here.
      field: { minSlotMinutes: item.minSlotMinutes, basePriceCentsPerHour: 0 },
      rules: [],
      busy: busyByField.get(item.id) ?? [],
    }).find((slot) => slot.available);
    if (free && (!earliest || free.startsAt < earliest)) {
      earliest = free.startsAt;
    }
  }
  if (!earliest) return null;
  const minute = localMinuteOf(earliest, venue.timezone);
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/**
 * `nextFreeTime` for many venues with ONE busy query (blocks and active
 * bookings of all their fields over the span of their local days).
 */
export async function loadNextFreeTimes(
  db: Pick<Db, 'execute'>,
  venues: readonly NextFreeVenue[],
  now: Date,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const withFields = venues.filter((item) => item.fields.length > 0);
  for (const item of venues) {
    if (item.fields.length === 0) result.set(item.id, null);
  }
  if (withFields.length === 0) return result;

  // A slot starting late in the day can run past midnight: look one day on.
  const ranges = withFields.map((item) =>
    localDayRange(localDateOf(now, item.timezone), item.timezone),
  );
  const from = new Date(
    Math.min(...ranges.map((range) => range.start.getTime())),
  );
  const to = new Date(
    Math.max(...ranges.map((range) => range.end.getTime())) + DAY_MS,
  );
  const busy = await loadBusy(
    db,
    withFields.flatMap((item) => item.fields.map((f) => f.id)),
    from,
    to,
    now,
  );
  for (const item of withFields) {
    result.set(item.id, nextFreeTime(item, busy, now));
  }
  return result;
}
