import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  bookingSchema,
  createBookingInputSchema,
} from './booking.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

const base = {
  id: ID,
  status: 'held',
  startsAt: '2026-11-02T13:00:00.000Z',
  endsAt: '2026-11-02T14:00:00.000Z',
  totalCents: 10000,
  holdExpiresAt: '2026-11-02T12:10:00.000Z',
  venue: {
    slug: 'arena',
    name: 'Arena',
    neighborhood: 'Centro',
    city: 'São Paulo',
    timezone: 'America/Sao_Paulo',
  },
  field: { id: ID, name: 'Quadra 1' },
  address: null,
};

describe('booking contracts', () => {
  it('expõe status e rótulos pt-BR', () => {
    expect(BOOKING_STATUSES).toEqual([
      'held',
      'confirmed',
      'cancelled',
      'expired',
    ]);
    expect(BOOKING_STATUS_LABELS).toEqual({
      held: 'Aguardando pagamento',
      confirmed: 'Confirmada',
      cancelled: 'Cancelada',
      expired: 'Expirada',
    });
  });

  it('valida a resposta do jogador, com endereço só quando informado', () => {
    expect(bookingSchema.safeParse(base).success).toBe(true);
    expect(
      bookingSchema.safeParse({
        ...base,
        status: 'confirmed',
        holdExpiresAt: null,
        address: {
          street: 'Rua A',
          number: '1',
          complement: null,
          cep: '01310100',
          phone: '(11) 98765-4321',
        },
      }).success,
    ).toBe(true);
    expect(bookingSchema.safeParse({ ...base, status: 'x' }).success).toBe(
      false,
    );
    expect(bookingSchema.safeParse({ ...base, totalCents: 0 }).success).toBe(
      false,
    );
  });

  it('valida a entrada de criação (sem preço)', () => {
    const ok = (input: Record<string, unknown>) =>
      createBookingInputSchema.safeParse({
        fieldId: ID,
        startsAt: '2026-11-02T10:00:00-03:00',
        durationMinutes: 60,
        ...input,
      }).success;
    expect(ok({})).toBe(true);
    expect(ok({ durationMinutes: 30 })).toBe(true);
    expect(ok({ durationMinutes: 360 })).toBe(true);
    expect(ok({ durationMinutes: 390 })).toBe(false);
    expect(ok({ durationMinutes: 0 })).toBe(false);
    expect(ok({ durationMinutes: 45 })).toBe(false);
    expect(ok({ durationMinutes: 60.5 })).toBe(false);
    expect(ok({ startsAt: '2026-11-02T10:00:00' })).toBe(false);
    expect(ok({ fieldId: 'abc' })).toBe(false);
    const parsed = createBookingInputSchema.parse({
      fieldId: ID,
      startsAt: '2026-11-02T10:00:00-03:00',
      durationMinutes: 60,
      totalCents: 1,
    });
    expect('totalCents' in parsed).toBe(false);
  });
});
