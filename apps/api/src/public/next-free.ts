import {
  daySlots,
  localDateOf,
  localDayRange,
  localMinuteOf,
  type HoursRow,
  type Interval,
} from '@arenaz/booking-core';
import { PUBLIC_FREE_TIMES_LIMIT } from '@arenaz/contracts';
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
 * "HH:MM" (venue wall clock) of the first `limit` slot starts still free
 * today, on any of the venue's active fields: ascending, each time once (two
 * fields free at 20:00 count once). Same slot rule as the public availability
 * (`daySlots`): 30 minute grid, never in the past, the field's minimum block
 * must fit inside the opening hours and miss every busy interval. Only the
 * venue's local date of `now` counts, so a slot after midnight does not.
 */
export function freeTimes(
  venue: NextFreeVenue,
  busyByField: ReadonlyMap<string, readonly Interval[]>,
  now: Date,
  limit: number = PUBLIC_FREE_TIMES_LIMIT,
): string[] {
  const date = localDateOf(now, venue.timezone);
  const starts = new Set<number>();
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
    })
      .filter((slot) => slot.available)
      .slice(0, limit);
    for (const slot of free) starts.add(slot.startsAt.getTime());
  }
  return [...starts]
    .sort((a, b) => a - b)
    .slice(0, limit)
    .map((ms) => {
      const minute = localMinuteOf(new Date(ms), venue.timezone);
      return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
    });
}

/** The first of `freeTimes`, or `null` when nothing is free today. */
export function nextFreeTime(
  venue: NextFreeVenue,
  busyByField: ReadonlyMap<string, readonly Interval[]>,
  now: Date,
): string | null {
  return freeTimes(venue, busyByField, now, 1)[0] ?? null;
}

/**
 * `freeTimes` for many venues with ONE busy query (blocks and active
 * bookings of all their fields over the span of their local days).
 */
export async function loadFreeTimes(
  db: Pick<Db, 'execute'>,
  venues: readonly NextFreeVenue[],
  now: Date,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const withFields = venues.filter((item) => item.fields.length > 0);
  for (const item of venues) {
    if (item.fields.length === 0) result.set(item.id, []);
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
    result.set(item.id, freeTimes(item, busy, now));
  }
  return result;
}

/** `nextFreeTime` for many venues (the first of `loadFreeTimes`). */
export async function loadNextFreeTimes(
  db: Pick<Db, 'execute'>,
  venues: readonly NextFreeVenue[],
  now: Date,
): Promise<Map<string, string | null>> {
  const free = await loadFreeTimes(db, venues, now);
  return new Map(
    [...free].map(([id, times]) => [id, times[0] ?? null] as const),
  );
}
