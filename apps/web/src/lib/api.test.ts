import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn((): never => {
    throw new Error('NEXT_REDIRECT');
  }),
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

import { apiGet } from './api';

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

describe('apiGet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
    mocks.cookies.mockResolvedValue({ toString: () => 'session=abc' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('forwards the cookies to the API without caching', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await apiGet('/owner/venues', schema, '/painel');

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/owner/venues', {
      headers: { cookie: 'session=abc' },
      cache: 'no-store',
    });
  });

  it('returns the body parsed by the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 7, extra: true }));

    await expect(apiGet('/x', schema, '/painel')).resolves.toEqual({ n: 7 });
  });

  it('redirects to the sign-in page, remembering the current path, on 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { status: 401 }));

    await expect(
      apiGet('/owner/venues/abc', schema, '/painel/espacos/abc'),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/entrar?next=/painel/espacos/abc',
    );
  });

  it('renders the not-found page on 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { status: 404 }));

    await expect(apiGet('/x', schema, '/painel')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it('throws on any other failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { status: 500 }));

    await expect(apiGet('/x', schema, '/painel')).rejects.toThrow(/500/);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('throws when the body does not match the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 'x' }));

    await expect(apiGet('/x', schema, '/painel')).rejects.toThrow('invalid');
  });

  it('falls back to localhost:4000 when API_URL is unset', async () => {
    vi.stubEnv('API_URL', undefined);
    fetchMock.mockResolvedValue(jsonResponse(200, { n: 1 }));

    await apiGet('/x', schema, '/painel');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/x',
      expect.anything(),
    );
  });
});
