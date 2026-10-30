import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SHOWCASE_MOCK } from './hero-showcase';
import { useHeroShowcase } from './use-hero-showcase';

const NEXT = {
  bookingId: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10',
  venueName: 'Padel Pinheiros',
  venueSlug: 'padel-pinheiros',
  coverUrl: 'https://fotos.test/venues/a/capa.w800.webp',
  when: 'Amanhã · 19h às 20h · Quadra 1',
  code: '#AZ-3F0C',
};

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useHeroShowcase', () => {
  it('signed out: keeps the illustration and never calls the API', () => {
    const { result } = renderHook(() => useHeroShowcase(false));

    expect(result.current).toBe(HERO_SHOWCASE_MOCK);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the next booking, asking once, uncached, with the session cookie', async () => {
    fetchMock.mockResolvedValue(answer(200, { booking: NEXT }));
    const { result } = renderHook(() => useHeroShowcase(true));

    // The illustration is the first frame: nothing blinks while it loads.
    expect(result.current).toBe(HERO_SHOWCASE_MOCK);
    await waitFor(() => {
      expect(result.current.booking).toEqual({
        venueName: 'Padel Pinheiros',
        when: 'Amanhã · 19h às 20h · Quadra 1',
        code: '#AZ-3F0C',
        photoUrl: 'https://fotos.test/venues/a/capa.w800.webp',
      });
    });
    // The racha stays the illustration until Plano 5.
    expect(result.current.racha).toBe(HERO_SHOWCASE_MOCK.racha);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bookings/me/next',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
      }),
    );
  });

  it('falls back to the card photo when the venue has no cover', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { booking: { ...NEXT, coverUrl: null } }),
    );
    const { result } = renderHook(() => useHeroShowcase(true));

    await waitFor(() => {
      expect(result.current.booking.venueName).toBe('Padel Pinheiros');
    });
    expect(result.current.booking.photoUrl).toBe(
      HERO_SHOWCASE_MOCK.booking.photoUrl,
    );
  });

  it.each([
    ['no upcoming booking', () => answer(200, { booking: null })],
    ['an expired session (401)', () => answer(401)],
    ['a server error', () => answer(500)],
    ['an unexpected body', () => answer(200, { booking: { id: 1 } })],
  ])('keeps the illustration on %s', async (_case, response) => {
    fetchMock.mockResolvedValue(response());
    const { result } = renderHook(() => useHeroShowcase(true));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    expect(result.current).toBe(HERO_SHOWCASE_MOCK);
  });

  it('keeps the illustration when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useHeroShowcase(true));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    expect(result.current).toBe(HERO_SHOWCASE_MOCK);
  });
});
