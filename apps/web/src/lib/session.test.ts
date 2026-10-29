import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

import { getSession } from './session';

const ME = {
  id: 'u1',
  name: 'Maria',
  email: 'maria@mail.com',
  createdAt: '2026-10-28T12:00:00.000Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('getSession', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
    mocks.cookies.mockResolvedValue({
      toString: () => 'better-auth.session_token=abc',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('forwards the request cookies to the API without caching', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ME));

    await getSession();

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/me', {
      headers: { cookie: 'better-auth.session_token=abc' },
      cache: 'no-store',
    });
  });

  it('returns the user on 200', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, ME));

    await expect(getSession()).resolves.toEqual(ME);
  });

  it('returns null on 401 (no session, expired or forged cookie)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        type: 'about:blank',
        title: 'Não autenticado',
        status: 401,
      }),
    );

    await expect(getSession()).resolves.toBeNull();
  });

  it('throws on other statuses instead of treating them as signed out', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { status: 500 }));

    await expect(getSession()).rejects.toThrow(/500/);
  });

  it('throws when the body is not a valid /me response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1 }));

    await expect(getSession()).rejects.toThrow();
  });

  it('falls back to localhost:4000 when API_URL is unset', async () => {
    vi.stubEnv('API_URL', undefined);
    fetchMock.mockResolvedValue(jsonResponse(200, ME));

    await getSession();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/me',
      expect.anything(),
    );
  });
});
