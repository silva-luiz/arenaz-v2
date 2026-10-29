import { randomUUID } from 'node:crypto';
import { createDb, schema } from '@arenaz/db';
import { inject } from 'vitest';

const { user, venue, field, booking } = schema;

export type Handle = ReturnType<typeof createDb>;

export function openDb(): Handle {
  return createDb(inject('DATABASE_URL'));
}

export interface Seeded {
  venueId: string;
  fieldId: string;
  userId: string;
}

/** A venue with one field and one user, unique per call (tests share a DB). */
export async function seedField(handle: Handle): Promise<Seeded> {
  const token = randomUUID();
  const userId = `u-${token}`;
  await handle.db.insert(user).values({
    id: userId,
    name: 'Jogador Teste',
    email: `${token}@teste.local`,
    emailVerified: true,
  });
  const [v] = await handle.db
    .insert(venue)
    .values({
      ownerId: userId,
      slug: `worker-${token.slice(0, 12)}`,
      name: `Arena Worker ${token.slice(0, 8)}`,
      phone: '(11) 98765-4321',
      cep: '01310100',
      street: 'Rua Teste',
      number: '1',
      neighborhood: `Bairro ${token.slice(0, 8)}`,
      city: 'Cidade Teste',
      state: 'SP',
      location: { lat: -23.55678, lng: -46.69123 },
      amenities: [],
      cancellationPolicy: 'flexivel',
      timezone: 'America/Sao_Paulo',
      status: 'published',
    })
    .returning({ id: venue.id });
  if (!v) throw new Error('seed de espaço falhou');
  const [f] = await handle.db
    .insert(field)
    .values({
      venueId: v.id,
      name: 'Quadra A',
      sports: ['futsal'],
      surface: 'piso_rigido',
      minSlotMinutes: 60,
      basePriceCentsPerHour: 8000,
      isActive: true,
    })
    .returning({ id: field.id });
  if (!f) throw new Error('seed de quadra falhou');
  return { venueId: v.id, fieldId: f.id, userId };
}

const HOUR_MS = 3_600_000;

/** Inserts a booking in its own 2-hour cell `slot` (far future, no overlap). */
export async function insertBooking(
  handle: Handle,
  seeded: Seeded,
  slot: number,
  status: 'held' | 'confirmed',
  holdExpiresAt: Date | null,
): Promise<string> {
  const start = new Date(Date.UTC(2031, 0, 1) + slot * 2 * HOUR_MS);
  const [row] = await handle.db
    .insert(booking)
    .values({
      fieldId: seeded.fieldId,
      venueId: seeded.venueId,
      userId: seeded.userId,
      origin: 'app',
      status,
      period: { startsAt: start, endsAt: new Date(start.getTime() + HOUR_MS) },
      totalCents: 8000,
      priceBreakdown: [],
      holdExpiresAt,
      confirmedAt: status === 'confirmed' ? new Date() : null,
    })
    .returning({ id: booking.id });
  if (!row) throw new Error('seed de reserva falhou');
  return row.id;
}
