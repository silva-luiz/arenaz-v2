import type { Booking } from '@arenaz/contracts';
import { describe, expect, it } from 'vitest';
import { splitBookings } from './bookings-list';

const NOW = new Date('2026-11-02T12:00:00.000Z');

function booking(
  id: string,
  status: Booking['status'],
  startsAt: string,
  endsAt: string,
): Booking {
  return {
    id,
    status,
    startsAt,
    endsAt,
    totalCents: 10000,
    holdExpiresAt: null,
    venue: {
      slug: 'arena',
      name: 'Arena',
      neighborhood: 'Centro',
      city: 'São Paulo',
      timezone: 'America/Sao_Paulo',
    },
    field: { id: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10', name: 'Quadra 1' },
    address: null,
  };
}

describe('splitBookings', () => {
  it('puts live bookings that have not ended in "Próximas", soonest first', () => {
    const later = booking(
      'a',
      'confirmed',
      '2026-11-05T13:00:00.000Z',
      '2026-11-05T14:00:00.000Z',
    );
    const sooner = booking(
      'b',
      'held',
      '2026-11-03T13:00:00.000Z',
      '2026-11-03T14:00:00.000Z',
    );
    const { upcoming, past } = splitBookings([later, sooner], NOW);
    expect(upcoming.map((item) => item.id)).toEqual(['b', 'a']);
    expect(past).toEqual([]);
  });

  it('puts ended, cancelled and expired bookings in "Anteriores", latest first', () => {
    const ended = booking(
      'ended',
      'confirmed',
      '2026-11-01T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
    );
    const cancelled = booking(
      'cancelled',
      'cancelled',
      '2026-11-09T13:00:00.000Z',
      '2026-11-09T14:00:00.000Z',
    );
    const expired = booking(
      'expired',
      'expired',
      '2026-11-04T13:00:00.000Z',
      '2026-11-04T14:00:00.000Z',
    );
    const { upcoming, past } = splitBookings([ended, expired, cancelled], NOW);
    expect(upcoming).toEqual([]);
    expect(past.map((item) => item.id)).toEqual([
      'cancelled',
      'expired',
      'ended',
    ]);
  });

  it('keeps a booking that is under way as upcoming', () => {
    const underWay = booking(
      'now',
      'confirmed',
      '2026-11-02T11:30:00.000Z',
      '2026-11-02T12:30:00.000Z',
    );
    expect(splitBookings([underWay], NOW).upcoming).toHaveLength(1);
  });
});
