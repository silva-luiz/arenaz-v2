import { MAX_PLAYERS, MIN_PLAYERS, whenLabel } from './booking-client';
import { formatZonedTime, zonedDateKey } from './zoned-time';

/** What the API enforces: a paid booking is cancelled up to this long before. */
export const FREE_CANCEL_HOURS = 24;
const HOUR_MS = 60 * 60_000;

/**
 * Group size carried from the venue page in `?jogadores=` (2 to 30). Anything
 * else, including a repeated parameter, is "not known": the checkout only
 * shows the players when it really knows them.
 */
export function parsePlayersParam(
  value: string | string[] | undefined,
): number | undefined {
  if (typeof value !== 'string' || !/^[1-9]\d?$/.test(value)) return undefined;
  const count = Number(value);
  return count >= MIN_PLAYERS && count <= MAX_PLAYERS ? count : undefined;
}

/** The booking page, with the group size when the venue page told it. */
export function bookingPath(id: string, players?: number): string {
  return players === undefined
    ? `/reservas/${id}`
    : `/reservas/${id}?jogadores=${String(players)}`;
}

/** The venue page, with the group size so going back keeps it. */
export function venuePath(slug: string, players?: number): string {
  return players === undefined
    ? `/espacos/${slug}`
    : `/espacos/${slug}?jogadores=${String(players)}`;
}

export interface CancelDeadline {
  /** "ter, 27 out, 20:00": 24 hours before the start, on the venue's clock. */
  label: string;
  /** Still possible to cancel (the API refuses from the deadline on). */
  open: boolean;
}

export function cancelDeadline(
  startsAt: string,
  timeZone: string,
  now: Date,
): CancelDeadline {
  const startMs = new Date(startsAt).getTime();
  const deadline = new Date(
    startMs - FREE_CANCEL_HOURS * HOUR_MS,
  ).toISOString();
  const day = whenLabel(zonedDateKey(deadline, timeZone));
  return {
    label: `${day.charAt(0).toLowerCase()}${day.slice(1)}, ${formatZonedTime(deadline, timeZone)}`,
    open: startMs - now.getTime() >= FREE_CANCEL_HOURS * HOUR_MS,
  };
}

/**
 * Whether the booking costs more than the court's base price for its length
 * ("horário nobre"). The server prices each half hour as `round(hour / 2)`,
 * so equal prices never read as dearer (same rule as the venue page's grid).
 */
export function isPeakBooking(
  totalCents: number,
  startsAt: string,
  endsAt: string,
  basePriceCentsPerHour: number,
): boolean {
  const segments =
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (30 * 60_000);
  return totalCents > segments * Math.round(basePriceCentsPerHour / 2);
}
