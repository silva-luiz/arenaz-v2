import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

import { INTERNAL_TOKEN_HEADER } from '@arenaz/contracts';
import { isSignedIn } from './venue-session';

function jar(names: string[]) {
  return {
    getAll: () => names.map((name) => ({ name, value: 'x' })),
    toString: () => names.map((name) => `${name}=x`).join('; '),
  };
}

describe('isSignedIn', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubEnv('INTERNAL_API_TOKEN', 'segredo-interno');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('does not call the API when there is no session cookie', async () => {
    mocks.cookies.mockResolvedValue(jar(['theme']));

    expect(await isSignedIn()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks /api/me with the cookies and the internal token header', async () => {
    mocks.cookies.mockResolvedValue(jar(['better-auth.session_token']));
    fetchMock.mockResolvedValue(
      Response.json({
        id: 'u1',
        name: 'Maria',
        email: 'maria@mail.com',
        createdAt: '2026-10-28T12:00:00.000Z',
      }),
    );

    expect(await isSignedIn()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/me');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({
      cookie: 'better-auth.session_token=x',
      [INTERNAL_TOKEN_HEADER]: 'segredo-interno',
    });
  });

  it('also recognises the secure cookie name', async () => {
    mocks.cookies.mockResolvedValue(
      jar(['__Secure-better-auth.session_token']),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    expect(await isSignedIn()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a failed check as signed out and logs it', async () => {
    mocks.cookies.mockResolvedValue(jar(['better-auth.session_token']));
    fetchMock.mockResolvedValue(new Response('boom', { status: 503 }));
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(await isSignedIn()).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('treats a network error as signed out and logs it', async () => {
    mocks.cookies.mockResolvedValue(jar(['better-auth.session_token']));
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(await isSignedIn()).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
