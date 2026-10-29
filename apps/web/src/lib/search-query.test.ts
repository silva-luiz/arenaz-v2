import { describe, expect, it } from 'vitest';
import { normalizeSearchParams, parseSearch, searchHref } from './search-query';

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
