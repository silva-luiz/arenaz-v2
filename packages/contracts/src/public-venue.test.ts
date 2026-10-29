import { describe, expect, it } from 'vitest';
import {
  PUBLIC_PAGE_SIZE,
  publicSearchQuerySchema,
  publicSearchResponseSchema,
  publicVenueCardSchema,
  publicVenueSchema,
} from './public-venue.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

function issuesOf(input: unknown): Record<string, string[]> {
  const result = publicSearchQuerySchema.safeParse(input);
  if (result.success) throw new Error('esperava falha');
  const out: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

describe('publicSearchQuerySchema', () => {
  it('aplica os padrões quando nada é enviado', () => {
    expect(publicSearchQuerySchema.parse({})).toEqual({
      radiusKm: 10,
      page: 1,
    });
  });

  it('coage strings e normaliza o texto', () => {
    expect(
      publicSearchQuerySchema.parse({
        q: '  vila   madalena ',
        sport: 'padel',
        lat: '-23.55',
        lng: '-46.69',
        radiusKm: '5',
        page: '3',
      }),
    ).toEqual({
      q: 'vila madalena',
      sport: 'padel',
      lat: -23.55,
      lng: -46.69,
      radiusKm: 5,
      page: 3,
    });
  });

  it('ignora parâmetros desconhecidos', () => {
    expect(publicSearchQuerySchema.parse({ foo: 'bar' })).toEqual({
      radiusKm: 10,
      page: 1,
    });
  });

  it.each([
    ['q curto', { q: 'a' }, 'q'],
    ['q só espaços', { q: '   ' }, 'q'],
    ['q longo', { q: 'a'.repeat(81) }, 'q'],
    ['esporte inválido', { sport: 'xyz' }, 'sport'],
    ['raio grande', { radiusKm: '10000' }, 'radiusKm'],
    ['raio zero', { radiusKm: '0' }, 'radiusKm'],
    ['raio fracionado', { radiusKm: '5.5' }, 'radiusKm'],
    ['q com NUL', { q: 'ab\u0000' }, 'q'],
    ['q com quebra de linha', { q: 'ab\ncd' }, 'q'],
    ['q com DEL', { q: 'ab\u007f' }, 'q'],
    ['raio não numérico', { radiusKm: 'abc' }, 'radiusKm'],
    ['página negativa', { page: '-1' }, 'page'],
    ['página zero', { page: '0' }, 'page'],
    ['página fracionada', { page: '1.5' }, 'page'],
    ['página acima do limite', { page: '51' }, 'page'],
    ['lat fora do Brasil', { lat: '999', lng: '0' }, 'lat'],
    ['lng fora do Brasil', { lat: '-23', lng: '0' }, 'lng'],
    ['lat vazia', { lat: '', lng: '-46' }, 'lat'],
    ['lat não numérica', { lat: 'x', lng: '-46' }, 'lat'],
    ['parâmetro repetido', { page: ['1', '2'] }, 'page'],
  ])('rejeita %s', (_name, input, field) => {
    expect(Object.keys(issuesOf(input))).toContain(field);
  });

  it('lat e lng andam juntos: o erro fica no que falta', () => {
    expect(issuesOf({ lat: '-23.5' })).toEqual({
      lng: ['Informe a latitude e a longitude juntas'],
    });
    expect(issuesOf({ lng: '-46.6' })).toEqual({
      lat: ['Informe a latitude e a longitude juntas'],
    });
  });
});

const approxLocation = { lat: -23.56, lng: -46.65 };

describe('publicVenueCardSchema', () => {
  const card = {
    slug: 'arena',
    name: 'Arena',
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: null,
    sports: ['padel'],
    minPriceCentsPerHour: 8000,
    approxLocation,
    distanceKm: null,
  };

  it('aceita um card válido', () => {
    expect(publicVenueCardSchema.parse(card)).toEqual(card);
  });

  it('descarta campos privados que sobrarem', () => {
    const parsed = publicVenueCardSchema.parse({
      ...card,
      phone: '11',
      street: 'Rua',
    });
    expect(parsed).not.toHaveProperty('phone');
    expect(parsed).not.toHaveProperty('street');
  });

  it('resposta paginada tem pageSize fixo', () => {
    expect(PUBLIC_PAGE_SIZE).toBe(20);
    expect(
      publicSearchResponseSchema.parse({
        items: [card],
        page: 1,
        pageSize: 20,
        hasMore: false,
      }).pageSize,
    ).toBe(20);
    expect(() =>
      publicSearchResponseSchema.parse({
        items: [],
        page: 1,
        pageSize: 10,
        hasMore: false,
      }),
    ).toThrow();
  });
});

describe('publicVenueSchema', () => {
  const venue = {
    slug: 'arena',
    name: 'Arena',
    description: null,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    approxLocation,
    amenities: ['bar'],
    cancellationPolicy: 'flexivel',
    hours: [{ weekday: 1, openMinute: 480, closeMinute: 1320 }],
    photos: [{ id: ID, url: 'http://x/y.png', position: 0 }],
    host: { firstName: 'Maria' },
    fields: [
      {
        id: ID,
        name: 'Quadra 1',
        sports: ['padel'],
        surface: 'piso_rigido',
        format: null,
        lengthM: null,
        widthM: 10.5,
        minSlotMinutes: 60,
        basePriceCentsPerHour: 8000,
        priceRules: [
          {
            weekdays: [6],
            startMinute: 600,
            endMinute: 720,
            priceCentsPerHour: 12000,
            label: null,
          },
        ],
      },
    ],
  };

  it('aceita um espaço público válido', () => {
    expect(publicVenueSchema.parse(venue)).toEqual(venue);
  });

  it('não deixa passar dado privado nem ids do dono', () => {
    const parsed = publicVenueSchema.parse({
      ...venue,
      phone: '(11) 98765-4321',
      street: 'Rua A',
      cep: '01310100',
      ownerId: 'u1',
      host: { firstName: 'Maria', id: 'u1', email: 'a@b.c' },
    });
    expect(parsed).toEqual(venue);
  });
});
