import { describe, expect, it } from 'vitest';
import {
  venueHoursSchema,
  venueInputSchema,
  venueSchema,
  venueSummarySchema,
  venueUpdateSchema,
} from './venue.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

const validInput = {
  name: '  Arena Central  ',
  phone: '(11) 98765-4321',
  address: {
    cep: '01310-100',
    street: 'Avenida Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  location: { lat: -23.56, lng: -46.65 },
  amenities: ['vestiario', 'bar'],
  cancellationPolicy: 'flexivel',
};

describe('venueInputSchema', () => {
  it('normaliza CEP, telefone e nome', () => {
    const r = venueInputSchema.parse(validInput);
    expect(r.address.cep).toBe('01310100');
    expect(r.phone).toBe('+5511987654321');
    expect(r.name).toBe('Arena Central');
  });

  it('normaliza CEP e rejeita localização fora do Brasil', () => {
    expect(venueInputSchema.parse(validInput).address.cep).toBe('01310100');
    const r = venueInputSchema.safeParse({
      ...validInput,
      location: { lat: 40, lng: -46.65 },
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(
      'Localização fora do Brasil',
    );
  });

  it('rejeita nome curto, comodidades repetidas/desconhecidas e política inválida', () => {
    const bad = (patch: object) =>
      venueInputSchema.safeParse({ ...validInput, ...patch }).success;
    expect(bad({ name: 'ab' })).toBe(false);
    expect(bad({ amenities: ['bar', 'bar'] })).toBe(false);
    expect(bad({ amenities: ['piscina'] })).toBe(false);
    expect(bad({ cancellationPolicy: 'x' })).toBe(false);
    expect(bad({ description: 'x'.repeat(2001) })).toBe(false);
  });

  it('update aceita parcial', () => {
    expect(venueUpdateSchema.safeParse({ name: 'Nova Arena' }).success).toBe(
      true,
    );
    expect(venueUpdateSchema.safeParse({}).success).toBe(true);
    expect(venueUpdateSchema.safeParse({ name: 'ab' }).success).toBe(false);
  });
});

describe('venueHoursSchema', () => {
  it('aceita horários válidos', () => {
    expect(
      venueHoursSchema.safeParse([
        { weekday: 1, openMinute: 480, closeMinute: 1380 },
        { weekday: 2, openMinute: 480, closeMinute: 1440 },
      ]).success,
    ).toBe(true);
  });

  it('rejeita horário com fechamento antes da abertura e dia repetido', () => {
    const closing = venueHoursSchema.safeParse([
      { weekday: 1, openMinute: 600, closeMinute: 600 },
    ]);
    expect(closing.success).toBe(false);
    expect(JSON.stringify(closing.error?.issues)).toContain(
      'O fechamento precisa ser depois da abertura',
    );

    const dup = venueHoursSchema.safeParse([
      { weekday: 1, openMinute: 480, closeMinute: 600 },
      { weekday: 1, openMinute: 660, closeMinute: 720 },
    ]);
    expect(dup.success).toBe(false);
    expect(dup.error?.issues[0]?.path).toEqual([1, 'weekday']);
  });

  it('rejeita minuto fora de múltiplo de 30 e dia fora de 0–6', () => {
    expect(
      venueHoursSchema.safeParse([
        { weekday: 1, openMinute: 485, closeMinute: 600 },
      ]).success,
    ).toBe(false);
    expect(
      venueHoursSchema.safeParse([
        { weekday: 7, openMinute: 480, closeMinute: 600 },
      ]).success,
    ).toBe(false);
  });
});

describe('response schemas', () => {
  const field = {
    id: ID,
    name: 'Quadra 1',
    sports: ['futsal'],
    surface: 'piso_rigido',
    format: null,
    lengthM: null,
    widthM: null,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
    isActive: true,
    priceRulesCount: 0,
  };

  it('venueSchema aceita resposta completa', () => {
    const r = venueSchema.safeParse({
      id: ID,
      slug: 'arena-central',
      name: 'Arena Central',
      description: null,
      phone: '+5511987654321',
      address: { ...validInput.address, cep: '01310100', complement: null },
      location: validInput.location,
      amenities: ['bar'],
      cancellationPolicy: 'moderada',
      status: 'draft',
      hours: [{ weekday: 1, openMinute: 480, closeMinute: 1380 }],
      photos: [{ id: ID, url: 'https://cdn.example.com/a.png', position: 0 }],
      fields: [field],
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-29T12:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('venueSummarySchema aceita item de lista', () => {
    expect(
      venueSummarySchema.safeParse({
        id: ID,
        slug: 'arena-central',
        name: 'Arena Central',
        status: 'published',
        city: 'São Paulo',
        fieldsCount: 2,
        coverUrl: null,
      }).success,
    ).toBe(true);
  });
});
