import type { OwnerAgenda, Venue } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import AgendaPage from './page';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

const VENUE = {
  id: ID,
  name: 'Arena Central',
  timezone: 'America/Sao_Paulo',
  hours: [{ weekday: 4, openMinute: 480, closeMinute: 1320 }],
} as unknown as Venue;

function agendaFor(date: string): OwnerAgenda {
  return {
    date,
    timezone: 'America/Sao_Paulo',
    fields: [{ id: FIELD_ID, name: 'Quadra 1', isActive: true, items: [] }],
  };
}

async function renderPage(search: Record<string, string> = {}) {
  return render(
    await AgendaPage({
      params: Promise.resolve({ id: ID }),
      searchParams: Promise.resolve(search),
    }),
  );
}

function requested(): string[] {
  return mocks.apiGet.mock.calls.map((call) => call[0] as string);
}

describe('/painel/espacos/[id]/agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 2026-10-29 (Thursday) 12:00 in São Paulo.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
    mocks.apiGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes('/agenda')
          ? agendaFor(new URL(`http://x${path}`).searchParams.get('date') ?? '')
          : VENUE,
      ),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the venue and the agenda of today by default', async () => {
    await renderPage();
    expect(requested()).toContain(`/owner/venues/${ID}`);
    expect(requested()).toContain(`/owner/venues/${ID}/agenda?date=2026-10-29`);
    expect(mocks.apiGet.mock.calls[0]?.[2]).toBe(
      `/painel/espacos/${ID}/agenda`,
    );
  });

  it('has seven day links, today first, marking the current one', async () => {
    await renderPage();
    const nav = screen.getByRole('navigation', { name: 'Dia da agenda' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(7);
    expect(links[0]).toHaveTextContent('Hoje');
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links[0]).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}/agenda?data=2026-10-29`,
    );
    expect(links[6]).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}/agenda?data=2026-11-04`,
    );
  });

  it('opens the day of the query string', async () => {
    await renderPage({ data: '2026-11-02' });
    expect(requested()).toContain(`/owner/venues/${ID}/agenda?date=2026-11-02`);
    const nav = screen.getByRole('navigation', { name: 'Dia da agenda' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Seg 2');
  });

  it.each(['2026-11-30', '2026-10-28', 'ontem', '2026-02-31'])(
    'falls back to today for %s',
    async (data) => {
      await renderPage({ data });
      expect(requested()).toContain(
        `/owner/venues/${ID}/agenda?date=2026-10-29`,
      );
    },
  );

  it('has the page heading and a way back to the venue', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Agenda' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Arena Central' })).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}`,
    );
  });

  it('lets the not-found of the API (another owner, bad id) through', async () => {
    mocks.apiGet.mockRejectedValue(new Error('NEXT_HTTP_ERROR_FALLBACK;404'));
    await expect(renderPage()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('lets a failing agenda request through instead of an empty page', async () => {
    mocks.apiGet.mockImplementation((path: string) =>
      path.includes('/agenda')
        ? Promise.reject(new Error('GET falhou com status 500'))
        : Promise.resolve(VENUE),
    );
    await expect(renderPage()).rejects.toThrow('status 500');
  });
});
