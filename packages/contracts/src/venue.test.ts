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

  it('fuso é opcional e só aceita a lista brasileira', () => {
    expect(venueInputSchema.parse(validInput).timezone).toBeUndefined();
    expect(
      venueInputSchema.parse({ ...validInput, timezone: 'America/Manaus' })
        .timezone,
    ).toBe('America/Manaus');
    expect(
      venueInputSchema.safeParse({ ...validInput, timezone: 'Europe/Lisbon' })
        .success,
    ).toBe(false);
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

  it('rejeita horário com fechamento antes da abertura', () => {
    const closing = venueHoursSchema.safeParse([
      { weekday: 1, openMinute: 600, closeMinute: 600 },
    ]);
    expect(closing.success).toBe(false);
    expect(JSON.stringify(closing.error?.issues)).toContain(
      'O fechamento precisa ser depois da abertura',
    );
  });

  it('aceita dois intervalos no mesmo dia, inclusive encostados', () => {
    expect(
      venueHoursSchema.safeParse([
        { weekday: 5, openMinute: 480, closeMinute: 720 },
        { weekday: 5, openMinute: 1020, closeMinute: 1440 },
        { weekday: 6, openMinute: 0, closeMinute: 120 },
      ]).success,
    ).toBe(true);
    expect(
      venueHoursSchema.safeParse([
        { weekday: 5, openMinute: 480, closeMinute: 720 },
        { weekday: 5, openMinute: 720, closeMinute: 900 },
      ]).success,
    ).toBe(true);
  });

  it('rejeita intervalos que se cruzam no mesmo dia, apontando o mais tarde', () => {
    const cross = venueHoursSchema.safeParse([
      { weekday: 1, openMinute: 480, closeMinute: 720 },
      { weekday: 1, openMinute: 660, closeMinute: 900 },
    ]);
    expect(cross.success).toBe(false);
    expect(cross.error?.issues[0]?.message).toBe('Horários se sobrepõem');
    expect(cross.error?.issues[0]?.path).toEqual([1, 'openMinute']);

    // Out of order in the payload: the LATER interval (by time) is flagged.
    const reversed = venueHoursSchema.safeParse([
      { weekday: 1, openMinute: 660, closeMinute: 900 },
      { weekday: 1, openMinute: 480, closeMinute: 720 },
    ]);
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]?.path).toEqual([0, 'openMinute']);

    // Same interval twice.
    expect(
      venueHoursSchema.safeParse([
        { weekday: 1, openMinute: 480, closeMinute: 720 },
        { weekday: 1, openMinute: 480, closeMinute: 720 },
      ]).success,
    ).toBe(false);
  });

  it('aceita no máximo 21 intervalos', () => {
    const slot = (weekday: number, index: number) => ({
      weekday,
      openMinute: index * 240,
      closeMinute: index * 240 + 120,
    });
    const make = (count: number) =>
      Array.from({ length: count }, (_, i) => slot(i % 7, Math.floor(i / 7)));
    expect(venueHoursSchema.safeParse(make(21)).success).toBe(true);
    expect(venueHoursSchema.safeParse(make(22)).success).toBe(false);
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
      timezone: 'America/Manaus',
      status: 'draft',
      hours: [{ weekday: 1, openMinute: 480, closeMinute: 1380 }],
      photos: [
        {
          id: ID,
          url: 'https://cdn.example.com/a.png',
          srcSet: null,
          position: 0,
        },
      ],
      fields: [field],
      createdAt: '2026-10-29T12:00:00.000Z',
      updatedAt: '2026-10-29T12:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('venueSchema exige o fuso', () => {
    expect(venueSchema.shape.timezone.safeParse('America/Bahia').success).toBe(
      true,
    );
    expect(venueSchema.shape.timezone.safeParse(undefined).success).toBe(false);
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
        coverSrcSet: null,
      }).success,
    ).toBe(true);
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
    ).toBe(false);
  });
});
