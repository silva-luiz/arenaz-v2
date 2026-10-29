import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));
vi.mock('@/lib/public-api', () => ({ publicGet: mocks.publicGet }));

import sitemap, { dynamic } from './sitemap';

const BASE = 'http://localhost:3000';

function card(slug: string) {
  return { slug };
}

function urls(entries: { url: string }[]) {
  return entries.map((entry) => entry.url);
}

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('is rendered per request, so the build never calls the API', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('lists the static pages and every published venue', async () => {
    mocks.publicGet.mockResolvedValue({
      items: [card('arena-central'), card('arena-norte')],
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    const entries = await sitemap();

    expect(urls(entries)).toEqual([
      `${BASE}/`,
      `${BASE}/buscar`,
      `${BASE}/espacos/arena-central`,
      `${BASE}/espacos/arena-norte`,
    ]);
    // The API does not expose a modification date: nothing is made up.
    entries.forEach((entry) => {
      expect(entry).not.toHaveProperty('lastModified');
    });
  });

  it('asks for page 1 with an hourly revalidation and stops at hasMore=false', async () => {
    mocks.publicGet
      .mockResolvedValueOnce({
        items: [card('a')],
        page: 1,
        pageSize: 24,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [card('b')],
        page: 2,
        pageSize: 24,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [card('c')],
        page: 3,
        pageSize: 24,
        hasMore: false,
      });

    const entries = await sitemap();

    expect(mocks.publicGet).toHaveBeenCalledTimes(3);
    expect(mocks.publicGet.mock.calls.map((call) => String(call[0]))).toEqual([
      '/venues?page=1',
      '/venues?page=2',
      '/venues?page=3',
    ]);
    expect(mocks.publicGet.mock.calls[0]?.[2]).toEqual({ revalidate: 3600 });
    expect(urls(entries).slice(2)).toEqual([
      `${BASE}/espacos/a`,
      `${BASE}/espacos/b`,
      `${BASE}/espacos/c`,
    ]);
  });

  it('never asks for more than 50 pages', async () => {
    mocks.publicGet.mockImplementation((path: string) =>
      Promise.resolve({
        items: [card(`v-${path.split('=')[1] ?? ''}`)],
        page: 1,
        pageSize: 24,
        hasMore: true,
      }),
    );

    const entries = await sitemap();

    expect(mocks.publicGet).toHaveBeenCalledTimes(50);
    expect(entries).toHaveLength(2 + 50);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the last page ends the list', async () => {
    mocks.publicGet.mockResolvedValue({
      items: [card('a')],
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    await sitemap();

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('lists a slug once even if two pages return it', async () => {
    mocks.publicGet
      .mockResolvedValueOnce({
        items: [card('a'), card('b')],
        page: 1,
        pageSize: 24,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [card('b'), card('c')],
        page: 2,
        pageSize: 24,
        hasMore: false,
      });

    expect(urls(await sitemap()).slice(2)).toEqual([
      `${BASE}/espacos/a`,
      `${BASE}/espacos/b`,
      `${BASE}/espacos/c`,
    ]);
  });

  it('falls back to the static URLs, and logs, when the API fails', async () => {
    mocks.publicGet.mockRejectedValue(new Error('GET /api/venues falhou'));

    const entries = await sitemap();

    expect(urls(entries)).toEqual([`${BASE}/`, `${BASE}/buscar`]);
    expect(console.error).toHaveBeenCalled();
  });

  it('keeps the venues of the pages it did read when a later page fails', async () => {
    mocks.publicGet
      .mockResolvedValueOnce({
        items: [card('a')],
        page: 1,
        pageSize: 24,
        hasMore: true,
      })
      .mockRejectedValueOnce(new Error('boom'));

    expect(urls(await sitemap())).toEqual([
      `${BASE}/`,
      `${BASE}/buscar`,
      `${BASE}/espacos/a`,
    ]);
  });

  it('treats a missing page (null) as the end', async () => {
    mocks.publicGet.mockResolvedValue(null);

    expect(urls(await sitemap())).toEqual([`${BASE}/`, `${BASE}/buscar`]);
    expect(mocks.publicGet).toHaveBeenCalledTimes(1);
  });
});
