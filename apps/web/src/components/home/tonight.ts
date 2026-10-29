import type { Availability, PublicVenueCard } from '@arenaz/contracts';
import { formatZonedTime } from '@/lib/zoned-time';

/*
 * Plain module (no 'use client'): the home page, a server component, imports
 * these values; a constant exported from a client module would reach it as a
 * client reference, not as the value.
 */

/** Zone of the "today" asked of the availability (every venue is in Brazil). */
export const HOME_TIME_ZONE = 'America/Sao_Paulo';

/** How many cards a home rail shows at most. */
export const RAIL_LIMIT = 12;

export interface Tonight {
  /** At least one venue has a free time left today. */
  free: boolean;
  items: PublicVenueCard[];
}

/**
 * The "livre hoje à noite" rail: the venues with a free time left today,
 * earliest first. When none has one, every venue (no seal), so the rail is
 * never empty only because it is late; the heading changes with `free`.
 */
export function pickTonight(items: readonly PublicVenueCard[]): Tonight {
  const free = items
    .filter((venue) => venue.nextFreeTime !== null)
    .sort((a, b) => (a.nextFreeTime ?? '').localeCompare(b.nextFreeTime ?? ''));
  return free.length > 0
    ? { free: true, items: free.slice(0, RAIL_LIMIT) }
    : { free: false, items: items.slice(0, RAIL_LIMIT) };
}

export interface FreeStart {
  /** "20:00" on the venue's clock. */
  time: string;
  startsAt: string;
  fieldId: string;
  /** The field's minimum block: what a tap on the time books. */
  durationMinutes: number;
}

/**
 * The next `count` distinct free start times of a venue (any field), after
 * `nowMs`, earliest first. A time free on two fields counts once, on the
 * first field listed.
 */
export function nextFreeStarts(
  availability: Availability,
  nowMs: number,
  count = 3,
): FreeStart[] {
  const byStart = new Map<number, FreeStart>();
  for (const field of availability.fields) {
    for (const slot of field.slots) {
      const startMs = Date.parse(slot.startsAt);
      if (!slot.available || startMs <= nowMs || byStart.has(startMs)) continue;
      byStart.set(startMs, {
        time: formatZonedTime(slot.startsAt, availability.timezone),
        startsAt: slot.startsAt,
        fieldId: field.id,
        durationMinutes: field.minSlotMinutes,
      });
    }
  }
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, count)
    .map(([, start]) => start);
}

/** The next free times of one venue, for the mobile "Livre agora" card. */
export interface FreeStarts {
  slug: string;
  /** "YYYY-MM-DD" the availability is for. */
  date: string;
  starts: FreeStart[];
}

/**
 * The venue page with the time already chosen: the same
 * `?data=&quadra=&inicio=&duracao=` the page reads back after sign in. The
 * picker still checks it is free.
 */
export function freeStartHref(
  slug: string,
  date: string,
  start: FreeStart,
): string {
  const query = new URLSearchParams({
    data: date,
    quadra: start.fieldId,
    inicio: start.startsAt,
    duracao: String(start.durationMinutes),
  });
  return `/espacos/${slug}?${query.toString()}`;
}
