import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

import { publicGet, toSearchParams } from './public-api';

const schema = {
  parse(input: unknown): { n: number } {
    if (
      typeof input === 'object' &&
      input !== null &&
      'n' in input &&
      typeof input.n === 'number'
    ) {
      return { n: input.n };
    }
    throw new Error('invalid');
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('publicGet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubEnv('INTERNAL_API_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('calls the API with revalidate 60 by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await expect(publicGet('/venues', schema)).resolves.toEqual({ n: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/venues');
    expect(init).toMatchObject({ next: { revalidate: 60 } });
  });

  it('honours a custom revalidate', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await publicGet('/venues', schema, { revalidate: 5 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init).toMatchObject({ next: { revalidate: 5 } });
  });

  it('keeps revalidate 0 (no caching), not the 60 s default', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await publicGet('/venues', schema, { revalidate: 0 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init).toMatchObject({ next: { revalidate: 0 } });
  });

  it('never sends a cookie (public, cacheable data)', async () => {
    mocks.cookies.mockResolvedValue({ toString: () => 'session=abc' });
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await publicGet('/venues', schema);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(new Headers(init.headers).has('cookie')).toBe(false);
    expect(init.credentials).not.toBe('include');
  });

  it('sends x-internal-token only when INTERNAL_API_TOKEN is set', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, { n: 1 })),
    );

    await publicGet('/venues', schema);
    const without = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(without[1].headers).has('x-internal-token')).toBe(false);

    vi.stubEnv('INTERNAL_API_TOKEN', 'x'.repeat(32));
    await publicGet('/venues', schema);
    const withToken = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(withToken[1].headers).get('x-internal-token')).toBe(
      'x'.repeat(32),
    );
  });

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { status: 404 }));

    await expect(publicGet('/venues/nada', schema)).resolves.toBeNull();
  });

  it('throws on other statuses', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { status: 503 }));

    await expect(publicGet('/venues', schema)).rejects.toThrow(/503/);
  });

  it('throws when the body does not match the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 'x' }));

    await expect(publicGet('/venues', schema)).rejects.toThrow('invalid');
  });

  it('falls back to localhost:4000 when API_URL is unset', async () => {
    vi.stubEnv('API_URL', undefined);
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await publicGet('/venues', schema);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/venues',
    );
  });
});

describe('toSearchParams', () => {
  it('keeps filled values', () => {
    const params = toSearchParams({ q: 'vila', sport: 'padel', page: 2 });

    expect(params.toString()).toBe('q=vila&sport=padel&page=2');
  });

  it('drops empty, undefined, null and whitespace-only values', () => {
    const params = toSearchParams({
      q: '',
      sport: undefined,
      lat: null,
      lng: '   ',
      page: 1,
    });

    expect(params.toString()).toBe('page=1');
  });

  it('trims the values it keeps', () => {
    expect(toSearchParams({ q: '  vila madalena ' }).get('q')).toBe(
      'vila madalena',
    );
  });

  it('keeps a zero', () => {
    expect(toSearchParams({ lat: 0 }).get('lat')).toBe('0');
  });

  it('passes the amenity filters and the price cap through', () => {
    const params = toSearchParams({
      amenities: ['coberta', ' vestiario ', ''],
      maxPrice: 200,
    });

    expect(params.get('amenities')).toBe('coberta,vestiario');
    expect(params.get('maxPrice')).toBe('200');
  });

  it('drops a list with nothing in it', () => {
    expect(toSearchParams({ amenities: [], q: 'vila' }).toString()).toBe(
      'q=vila',
    );
    expect(toSearchParams({ amenities: [' '] }).toString()).toBe('');
  });
});
