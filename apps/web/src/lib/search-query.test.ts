import { describe, expect, it } from 'vitest';
import {
  PRICE_CHIP_REAIS,
  apiQuery,
  normalizeSearchParams,
  parseSearch,
  saoPauloDate,
  searchHref,
  venueHref,
  withAmenity,
  withMaxPrice,
} from './search-query';

// 2026-10-29 15:00 in São Paulo.
const NOW = new Date('2026-10-29T18:00:00Z');

describe('normalizeSearchParams', () => {
  it('drops empty and whitespace-only values (the form sends q= and sport=)', () => {
    expect(
      normalizeSearchParams({ q: '', sport: '   ', lat: undefined }),
    ).toEqual({});
  });

  it('trims, keeps the first value of a repeated key and ignores unknown keys', () => {
    expect(
      normalizeSearchParams({
        q: ['  vila  ', 'outra'],
        sport: 'futsal',
        utm_source: 'x',
      }),
    ).toEqual({ q: 'vila', sport: 'futsal' });
  });
});

describe('normalizeSearchParams coordinates', () => {
  it('rounds lat and lng to 3 decimals so cache keys stay bounded', () => {
    expect(
      normalizeSearchParams({ lat: '-23.5505199', lng: '-46.6333094' }),
    ).toEqual({ lat: '-23.551', lng: '-46.633' });
    expect(normalizeSearchParams({ lat: '-23.5', lng: '-46' })).toEqual({
      lat: '-23.5',
      lng: '-46',
    });
  });

  it('leaves a non-numeric coordinate for the schema to reject', () => {
    expect(normalizeSearchParams({ lat: 'abc', lng: '1e999' })).toEqual({
      lat: 'abc',
      lng: '1e999',
    });
  });

  it('feeds the rounded value to validation', () => {
    const result = parseSearch({ lat: '-23.5505199', lng: '-46.6333094' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({ lat: '-23.551', lng: '-46.633' });
      expect(result.query.lat).toBe(-23.551);
    }
  });
});

describe('parseSearch', () => {
  it('accepts a form submitted without JavaScript as the default search', () => {
    const result = parseSearch({ q: '', sport: '' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params).toEqual({});
      expect(result.query.q).toBeUndefined();
      expect(result.query.page).toBe(1);
    }
  });

  it('returns the schema message of each invalid field', () => {
    const result = parseSearch({ q: 'a', sport: 'xyz' });

    expect(result).toMatchObject({
      ok: false,
      messages: {
        q: 'A busca precisa ter pelo menos 2 caracteres',
        sport: 'Esporte inválido',
      },
    });
  });

  it('refuses lat without lng, naming the missing one', () => {
    expect(parseSearch({ lat: '-23.55' })).toMatchObject({
      ok: false,
      messages: { lng: 'Informe a latitude e a longitude juntas' },
    });
  });

  it('refuses a page out of range', () => {
    expect(parseSearch({ page: '51' })).toMatchObject({
      ok: false,
      messages: { page: 'A página máxima é 50' },
    });
  });
});

describe('searchHref', () => {
  it('keeps the filters and sets the page', () => {
    expect(searchHref({ q: 'vila madalena', sport: 'padel' }, 2)).toBe(
      '/buscar?q=vila+madalena&sport=padel&page=2',
    );
  });

  it('is /buscar without filters or page', () => {
    expect(searchHref({}, 1)).toBe('/buscar');
  });
});

describe('saoPauloDate', () => {
  it('is the calendar day in São Paulo, not in UTC', () => {
    expect(saoPauloDate(new Date('2026-10-30T01:30:00Z'))).toBe('2026-10-29');
    expect(saoPauloDate(new Date('2026-10-30T03:30:00Z'))).toBe('2026-10-30');
  });
});

describe('data and jogadores (intent carried to the venue page)', () => {
  it('keeps a date from today to today + 60 days', () => {
    expect(normalizeSearchParams({ data: '2026-10-29' }, NOW)).toEqual({
      data: '2026-10-29',
    });
    expect(normalizeSearchParams({ data: '2026-12-28' }, NOW)).toEqual({
      data: '2026-12-28',
    });
  });

  it.each([
    ['yesterday', '2026-10-28'],
    ['61 days ahead', '2026-12-29'],
    ['not a date', 'amanhã'],
    ['an impossible day', '2026-02-30'],
    ['another format', '29/10/2026'],
  ])('ignores %s', (_name, data) => {
    expect(normalizeSearchParams({ data }, NOW)).toEqual({});
  });

  it('uses the São Paulo day: at 22h local "today" is still valid', () => {
    const lateEvening = new Date('2026-10-30T01:00:00Z');
    expect(normalizeSearchParams({ data: '2026-10-29' }, lateEvening)).toEqual({
      data: '2026-10-29',
    });
  });

  it('keeps players from 2 to 30', () => {
    expect(normalizeSearchParams({ jogadores: '2' }, NOW)).toEqual({
      jogadores: '2',
    });
    expect(normalizeSearchParams({ jogadores: '30' }, NOW)).toEqual({
      jogadores: '30',
    });
  });

  it.each(['1', '31', '0', '-4', '10.5', 'dez', '1e1', '  '])(
    'ignores jogadores=%j',
    (jogadores) => {
      expect(normalizeSearchParams({ jogadores }, NOW)).toEqual({});
    },
  );

  it('an invalid date or player count never makes the search invalid', () => {
    const result = parseSearch({ data: 'x', jogadores: '99', q: 'vila' }, NOW);
    expect(result.ok).toBe(true);
    expect(result.params).toEqual({ q: 'vila' });
  });

  it('is not sent to the API', () => {
    expect(
      apiQuery({ q: 'vila', data: '2026-10-30', jogadores: '10', page: '2' }),
    ).toEqual({ q: 'vila', page: '2' });
  });

  it('survives a filter change in the URL', () => {
    expect(
      searchHref({ q: 'vila', data: '2026-10-30', jogadores: '10' }, 1),
    ).toBe('/buscar?q=vila&data=2026-10-30&jogadores=10');
  });
});

describe('venueHref', () => {
  it('carries date and players to the venue page', () => {
    expect(venueHref('arena-vm', { data: '2026-10-30', jogadores: '14' })).toBe(
      '/espacos/arena-vm?data=2026-10-30&jogadores=14',
    );
  });

  it('is the plain venue page without them, and ignores other filters', () => {
    expect(venueHref('arena-vm', { q: 'vila', sport: 'padel' })).toBe(
      '/espacos/arena-vm',
    );
    expect(venueHref('arena-vm', { jogadores: '8' })).toBe(
      '/espacos/arena-vm?jogadores=8',
    );
  });
});

describe('amenities and price in the URL', () => {
  it('accepts amenities and maxPrice as the API does', () => {
    const result = parseSearch(
      { amenities: 'coberta,vestiario', maxPrice: '200' },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.query.amenities).toEqual(['coberta', 'vestiario']);
      expect(result.query.maxPrice).toBe(200);
    }
    expect(apiQuery(result.params)).toEqual({
      amenities: 'coberta,vestiario',
      maxPrice: '200',
    });
  });

  it('refuses an unknown amenity with the schema message', () => {
    expect(parseSearch({ amenities: 'piscina' }, NOW)).toMatchObject({
      ok: false,
      messages: { amenities: 'Comodidade inválida' },
    });
  });

  it('adds and removes an amenity, keeping the others and the rest of the filters', () => {
    const base = { q: 'vila', amenities: 'coberta', page: '3' };
    expect(withAmenity(base, 'vestiario', true)).toEqual({
      q: 'vila',
      amenities: 'coberta,vestiario',
    });
    expect(withAmenity(base, 'coberta', false)).toEqual({ q: 'vila' });
    expect(withAmenity({}, 'coberta', true)).toEqual({ amenities: 'coberta' });
  });

  it('sets and clears the price ceiling, back to page 1', () => {
    expect(withMaxPrice({ q: 'vila', page: '2' }, PRICE_CHIP_REAIS)).toEqual({
      q: 'vila',
      maxPrice: String(PRICE_CHIP_REAIS),
    });
    expect(
      withMaxPrice({ maxPrice: '200', sport: 'padel' }, undefined),
    ).toEqual({
      sport: 'padel',
    });
  });

  it('PRICE_CHIP_REAIS is the "Até R$ 200/h" chip', () => {
    expect(PRICE_CHIP_REAIS).toBe(200);
  });
});
