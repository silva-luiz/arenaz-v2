import type { OwnerAgenda, Venue } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  getSession: vi.fn(),
  demo: { value: false },
}));

vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/demo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/demo')>()),
  get isDemoMode() {
    return mocks.demo.value;
  },
}));
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

const SUMMARY = { occupancyPct: 63, weekRevenueCents: 864000 };

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
    mocks.demo.value = false;
    mocks.getSession.mockResolvedValue({
      id: 'u1',
      name: 'Marcos Almeida',
      email: 'marcos@mail.com',
      createdAt: '2026-10-28T12:00:00.000Z',
    });
    mocks.apiGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes('/agenda')
          ? agendaFor(new URL(`http://x${path}`).searchParams.get('date') ?? '')
          : path.includes('/summary')
            ? SUMMARY
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

  it.each([
    ['today minus 30 days', '2026-09-29'],
    ['today plus 60 days', '2026-12-28'],
    ['a day beyond the week chips', '2026-11-30'],
    ['yesterday', '2026-10-28'],
  ])('opens %s from the query string', async (_name, data) => {
    await renderPage({ data });
    expect(requested()).toContain(`/owner/venues/${ID}/agenda?date=${data}`);
  });

  it.each(['2026-09-28', '2026-12-29', 'ontem', '2026-02-31', '2026-11-5'])(
    'falls back to today for %s',
    async (data) => {
      await renderPage({ data });
      expect(requested()).toContain(
        `/owner/venues/${ID}/agenda?date=2026-10-29`,
      );
    },
  );

  it('counts the range in the venue time zone, not the server one', async () => {
    // 2026-10-30 01:00 UTC is still the 29th in São Paulo, so -30 is 09-29.
    vi.setSystemTime(new Date('2026-10-30T01:00:00Z'));
    await renderPage({ data: '2026-09-29' });
    expect(requested()).toContain(`/owner/venues/${ID}/agenda?date=2026-09-29`);
  });

  it('has a labelled date field limited to the allowed range, filled with the shown day', async () => {
    await renderPage({ data: '2026-11-30' });

    const input = screen.getByLabelText('Ir para a data');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('name', 'data');
    expect(input).toHaveAttribute('min', '2026-09-29');
    expect(input).toHaveAttribute('max', '2026-12-28');
    expect(input).toHaveValue('2026-11-30');
    const form = input.closest('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', `/painel/espacos/${ID}/agenda`);
    expect(
      within(form as HTMLElement).getByRole('button', { name: 'Ver dia' }),
    ).toBeVisible();
  });

  it('has a Hoje link that goes back to today', async () => {
    await renderPage({ data: '2026-11-30' });

    const nav = screen.getByRole('navigation', { name: 'Dia da agenda' });
    expect(within(nav).getByRole('link', { name: /^Hoje, / })).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}/agenda?data=2026-10-29`,
    );
    // Outside the week chips, so none of them is the current one.
    expect(
      within(nav)
        .getAllByRole('link')
        .filter((item) => item.getAttribute('aria-current') === 'page'),
    ).toHaveLength(0);
  });

  it('greets the owner by first name at the hour of the venue, with today', async () => {
    await renderPage({ data: '2026-11-30' });
    // 15:00 UTC is 12:00 in São Paulo.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Boa tarde, Marcos' }),
    ).toBeVisible();
    expect(screen.getByText('Quinta, 29 de outubro')).toBeVisible();
  });

  it('shows the real indicators of today and nothing invented outside the demo', async () => {
    await renderPage({ data: '2026-11-30' });
    expect(requested()).toContain(
      `/owner/venues/${ID}/summary?date=2026-10-29`,
    );
    const occupancy = screen.getByText('Ocupação hoje').closest('div');
    expect(occupancy).toHaveTextContent('63%');
    const revenue = screen.getByText('Recebido na semana').closest('div');
    expect(revenue).toHaveTextContent('R$ 8.640');
    expect(revenue).toHaveTextContent('Tudo já pago no Pix');
    expect(screen.queryByText('Repasse de sexta')).toBeNull();
    expect(screen.queryByText('Mensalistas ativos')).toBeNull();
    expect(screen.queryByRole('button', { name: /Semana/ })).toBeNull();
  });

  it('does not claim a payment when nothing came in this week', async () => {
    mocks.apiGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes('/agenda')
          ? agendaFor('2026-10-29')
          : path.includes('/summary')
            ? { occupancyPct: 0, weekRevenueCents: 0 }
            : VENUE,
      ),
    );
    await renderPage();
    const revenue = screen.getByText('Recebido na semana').closest('div');
    expect(revenue).toHaveTextContent('R$ 0');
    expect(revenue).not.toHaveTextContent('Tudo já pago no Pix');
  });

  it('adds the demo indicators and the week tab only in the demo', async () => {
    mocks.demo.value = true;
    await renderPage();
    expect(
      screen.getByText('Repasse de sexta').closest('div'),
    ).toHaveTextContent('R$ 3.120Cai na conta 30/10');
    expect(
      screen.getByText('Mensalistas ativos').closest('div'),
    ).toHaveTextContent('12 times2 renovam esta semana');
    const week = screen.getByRole('button', { name: 'Semana (em breve)' });
    expect(week).toBeDisabled();
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
