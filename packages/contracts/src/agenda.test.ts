import { describe, expect, it } from 'vitest';
import { agendaItemSchema, manualBookingInputSchema } from './agenda.js';

const base = {
  startsAt: '2030-01-01T12:00:00.000Z',
  durationMinutes: 60,
  customerName: '  Carlos Silva ',
};

describe('manualBookingInputSchema', () => {
  it('aceita nome (aparado) e telefone opcional normalizado', () => {
    const parsed = manualBookingInputSchema.parse({
      ...base,
      customerPhone: '(11) 98765-4321',
    });
    expect(parsed.customerName).toBe('Carlos Silva');
    expect(parsed.customerPhone).toBe('+5511987654321');
    expect(manualBookingInputSchema.parse(base).customerPhone).toBeUndefined();
  });

  it('recusa nome curto ou longo e duração fora do passo', () => {
    expect(
      manualBookingInputSchema.safeParse({ ...base, customerName: 'A' })
        .success,
    ).toBe(false);
    expect(
      manualBookingInputSchema.safeParse({
        ...base,
        customerName: 'x'.repeat(81),
      }).success,
    ).toBe(false);
    expect(
      manualBookingInputSchema.safeParse({ ...base, durationMinutes: 45 })
        .success,
    ).toBe(false);
  });
});

describe('agendaItemSchema', () => {
  it('distingue reserva de bloqueio pelo kind', () => {
    const block = agendaItemSchema.safeParse({
      kind: 'block',
      id: '6f1d2c3e-1111-4222-8333-444455556666',
      startsAt: base.startsAt,
      endsAt: '2030-01-01T13:00:00.000Z',
      reason: null,
    });
    expect(block.success).toBe(true);
    expect(agendaItemSchema.safeParse({ kind: 'other' }).success).toBe(false);
  });
});
