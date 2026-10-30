import { bookingSchema, type Booking } from '@arenaz/contracts';

export interface SplitBookings {
  /** Held or confirmed and not over yet, soonest first. */
  upcoming: Booking[];
  /** Everything else, latest first. */
  past: Booking[];
}

/** "Próximas" and "Anteriores" of the player's bookings. */
export function splitBookings(bookings: Booking[], now: Date): SplitBookings {
  const upcoming: Booking[] = [];
  const past: Booking[] = [];
  for (const item of bookings) {
    const live = item.status === 'held' || item.status === 'confirmed';
    const over = new Date(item.endsAt).getTime() <= now.getTime();
    (live && !over ? upcoming : past).push(item);
  }
  const byStart = (a: Booking, b: Booking) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  upcoming.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  return { upcoming, past };
}

/** What `apiGet` needs to read `GET /bookings/me` (web has no zod of its own). */
export const bookingListParser = {
  parse(input: unknown): Booking[] {
    if (!Array.isArray(input)) throw new Error('Lista de reservas inválida');
    return input.map((item) => bookingSchema.parse(item));
  },
};
