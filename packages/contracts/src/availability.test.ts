import { describe, expect, it } from 'vitest';
import { availabilityQuerySchema, availabilitySchema } from './availability.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('availabilityQuerySchema', () => {
  it('aceita uma data de calendário válida', () => {
    expect(availabilityQuerySchema.parse({ date: '2026-11-02' })).toEqual({
      date: '2026-11-02',
    });
    expect(
      availabilityQuerySchema.safeParse({ date: '2028-02-29' }).success,
    ).toBe(true);
  });

  it.each([
    undefined,
    '',
    '2026-11-2',
    '02/11/2026',
    '2026-13-01',
    '2026-02-30',
    '2027-02-29',
    '2026-11-02T10:00:00Z',
    ' 2026-11-02',
    '2026-11-02\n',
    'abc',
  ])('recusa %j', (date) => {
    const result = availabilityQuerySchema.safeParse({ date });
    expect(result.success).toBe(false);
  });

  it('recusa data repetida (lista)', () => {
    expect(
      availabilityQuerySchema.safeParse({ date: ['2026-11-02', '2026-11-03'] })
        .success,
    ).toBe(false);
  });
});

describe('availabilitySchema', () => {
  const valid = {
    date: '2026-11-02',
    timezone: 'America/Sao_Paulo',
    fields: [
      {
        id: ID,
        name: 'Quadra 1',
        minSlotMinutes: 60,
        slots: [
          {
            startsAt: '2026-11-02T13:00:00.000Z',
            endsAt: '2026-11-02T14:00:00.000Z',
            available: true,
            priceCents: 8000,
          },
        ],
      },
    ],
  };

  it('valida a resposta', () => {
    expect(availabilitySchema.safeParse(valid).success).toBe(true);
  });

  it('não deixa passar campos privados nos horários', () => {
    const parsed = availabilitySchema.parse({
      ...valid,
      fields: [
        {
          ...valid.fields[0],
          slots: [
            {
              ...valid.fields[0]?.slots[0],
              bookingId: ID,
              userId: 'u',
              reason: 'manutenção',
            },
          ],
        },
      ],
    });
    expect(Object.keys(parsed.fields[0]?.slots[0] ?? {}).sort()).toEqual([
      'available',
      'endsAt',
      'priceCents',
      'startsAt',
    ]);
  });

  it('recusa preço negativo ou fracionado e fuso desconhecido', () => {
    const slot = valid.fields[0]?.slots[0];
    const withSlot = (override: object) => ({
      ...valid,
      fields: [{ ...valid.fields[0], slots: [{ ...slot, ...override }] }],
    });
    expect(
      availabilitySchema.safeParse(withSlot({ priceCents: -1 })).success,
    ).toBe(false);
    expect(
      availabilitySchema.safeParse(withSlot({ priceCents: 1.5 })).success,
    ).toBe(false);
    expect(
      availabilitySchema.safeParse({ ...valid, timezone: 'Mars/Base' }).success,
    ).toBe(false);
  });
});
