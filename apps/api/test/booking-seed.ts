import { randomUUID } from 'node:crypto';
import { schema } from '@arenaz/db';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../src/db/db.module.js';
import { uniqueToken } from './helpers.js';

const { venue, venueHours, field, priceRule, booking } = schema;

export const SP = 'America/Sao_Paulo';
const DAY_MS = 86_400_000;

/** Today in `America/Sao_Paulo` plus `days` calendar days (YYYY-MM-DD). */
export function spDate(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Brazil has no DST now: America/Sao_Paulo is UTC-3 all year. */
export const at = (date: string, hhmm: string): Date =>
  new Date(`${date}T${hhmm}:00-03:00`);

export interface SeededVenue {
  slug: string;
  venueId: string;
  /** Open 08:00-12:00, min 60 min, R$ 80/h, R$ 120/h from 10:00. */
  fieldId: string;
  inactiveFieldId: string;
}

/**
 * A venue open 08:00-12:00 every day. Quadra A: R$ 80/h, R$ 120/h from 10:00,
 * so 09:00-11:00 costs 4000+4000+6000+6000 = 20000.
 */
export async function seedVenue(
  handle: DbHandle,
  ownerId: string,
  opts: { status?: 'draft' | 'published' } = {},
): Promise<SeededVenue> {
  const token = uniqueToken();
  const [v] = await handle.db
    .insert(venue)
    .values({
      ownerId,
      slug: `res-${token}-${randomUUID().slice(0, 4)}`,
      name: `Arena Reserva ${token}`,
      phone: '(11) 98765-4321',
      cep: '01310100',
      street: 'Rua Sigilosa',
      number: '43210',
      complement: 'Fundos',
      neighborhood: `Bairro ${token}`,
      city: 'Cidade Teste',
      state: 'SP',
      location: { lat: -23.55678, lng: -46.69123 },
      amenities: [],
      cancellationPolicy: 'flexivel',
      timezone: SP,
      status: opts.status ?? 'published',
    })
    .returning({ id: venue.id, slug: venue.slug });
  if (!v) throw new Error('seed falhou');
  await handle.db.insert(venueHours).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      venueId: v.id,
      weekday,
      openMinute: 480,
      closeMinute: 720,
    })),
  );
  const mk = async (name: string, isActive: boolean): Promise<string> => {
    const [f] = await handle.db
      .insert(field)
      .values({
        venueId: v.id,
        name,
        sports: ['futsal'],
        surface: 'piso_rigido',
        minSlotMinutes: 60,
        basePriceCentsPerHour: 8000,
        isActive,
      })
      .returning({ id: field.id });
    if (!f) throw new Error('seed de quadra falhou');
    return f.id;
  };
  const fieldId = await mk('Quadra A', true);
  const inactiveFieldId = await mk('Quadra Inativa', false);
  await handle.db.insert(priceRule).values({
    fieldId,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 600,
    endMinute: 720,
    priceCentsPerHour: 12000,
  });
  return { slug: v.slug, venueId: v.id, fieldId, inactiveFieldId };
}

/**
 * A venue that opens 18:00-24:00 and, after midnight, 00:00-02:00 every day
 * (an overnight shift stored as two intervals). Quadra Noturna: 60 min blocks,
 * R$ 80/h base, but R$ 120/h 18:00-24:00 on `date`'s weekday and R$ 200/h
 * 00:00-02:00 on the next weekday, so 23:00-01:00 on `date` costs
 * 6000+6000+10000+10000 = 32000 only if each half is priced by its own weekday.
 */
export async function seedOvernightVenue(
  handle: DbHandle,
  ownerId: string,
  date: string,
): Promise<SeededVenue> {
  const s = await seedVenue(handle, ownerId);
  await handle.db.delete(venueHours).where(eq(venueHours.venueId, s.venueId));
  await handle.db.insert(venueHours).values(
    [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      { venueId: s.venueId, weekday, openMinute: 0, closeMinute: 120 },
      { venueId: s.venueId, weekday, openMinute: 1080, closeMinute: 1440 },
    ]),
  );
  await handle.db.delete(priceRule).where(eq(priceRule.fieldId, s.fieldId));
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  await handle.db.insert(priceRule).values([
    {
      fieldId: s.fieldId,
      weekdays: [weekday],
      startMinute: 1080,
      endMinute: 1440,
      priceCentsPerHour: 12000,
    },
    {
      fieldId: s.fieldId,
      weekdays: [(weekday + 1) % 7],
      startMinute: 0,
      endMinute: 120,
      priceCentsPerHour: 20000,
    },
  ]);
  return s;
}

/** Inserts a booking straight into the table (bypasses the service). */
export async function insertBooking(
  handle: DbHandle,
  seeded: SeededVenue,
  userId: string,
  start: Date,
  end: Date,
  status: 'held' | 'confirmed' | 'cancelled' | 'expired',
  holdExpiresAt: Date | null = null,
): Promise<string> {
  const [row] = await handle.db
    .insert(booking)
    .values({
      fieldId: seeded.fieldId,
      venueId: seeded.venueId,
      userId,
      origin: 'app',
      status,
      period: { startsAt: start, endsAt: end },
      totalCents: 8000,
      priceBreakdown: [],
      holdExpiresAt,
      confirmedAt: status === 'confirmed' ? new Date() : null,
    })
    .returning({ id: booking.id });
  if (!row) throw new Error('seed de reserva falhou');
  return row.id;
}

/** Moves the hold deadline of a booking into the past (the DB clock decides). */
export async function expireHold(
  handle: DbHandle,
  bookingId: string,
): Promise<void> {
  await handle.db
    .update(booking)
    .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(booking.id, bookingId));
}
