import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));
// `connection()` only works inside a real request.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
// The filter pills use the router; the rest of the module stays real.
vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn() }),
}));
// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub() {
      return <div data-testid="map-stub" />;
    },
}));
vi.mock('@/lib/public-api', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/public-api')>()),
  publicGet: mocks.publicGet,
}));

import SearchPage, { generateMetadata } from './page';

type Params = Record<string, string | string[] | undefined>;

function card(index: number, distanceKm: number | null = null) {
  return {
    slug: `arena-${String(index)}`,
    name: `Arena ${String(index)}`,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: null,
    coverSrcSet: null,
    sports: ['futsal', 'padel'],
    minPriceCentsPerHour: 18000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm,
    nextFreeTime: null as string | null,
    freeTimes: [] as string[],
  };
}

function response(count: number, hasMore = false, page = 1) {
  return {
    items: Array.from({ length: count }, (_, index) => card(index + 1)),
    page,
    pageSize: 20,
    hasMore,
  };
}

function props(searchParams: Params) {
  return { searchParams: Promise.resolve(searchParams) };
}

function messages(): string[] {
  return screen
    .queryAllByRole('alert')
    .map((alert) => alert.textContent)
    .filter((text) => text !== '');
}

async function renderPage(searchParams: Params = {}) {
  render(await SearchPage(props(searchParams)));
}

describe('search page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue(response(3));
  });

  describe('invalid params', () => {
    it('shows "Esporte inválido" for sport=xyz and does not call the API', async () => {
      await renderPage({ sport: 'xyz' });

      expect(messages()).toEqual(['Esporte inválido']);
      expect(mocks.publicGet).not.toHaveBeenCalled();
      expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
    });

    it('shows the schema message for a one-character q and makes no call', async () => {
      await renderPage({ q: 'a' });

      expect(messages()).toEqual([
        'A busca precisa ter pelo menos 2 caracteres',
      ]);
      expect(mocks.publicGet).not.toHaveBeenCalled();
    });

    it('keeps an h1 on the page', async () => {
      await renderPage({ sport: 'xyz' });

      expect(
        screen.getByRole('heading', { level: 1, name: 'Buscar quadras' }),
      ).toBeInTheDocument();
    });

    it('offers the way back to all venues', async () => {
      await renderPage({ page: '99' });

      expect(
        screen.getByRole('link', { name: 'Ver todos os espaços' }),
      ).toHaveAttribute('href', '/buscar');
    });
  });

  describe('empty params from a form without JavaScript', () => {
    it('renders the default (newest) results for ?q=&sport=', async () => {
      await renderPage({ q: '', sport: '' });

      expect(messages()).toEqual([]);
      expect(mocks.publicGet).toHaveBeenCalledTimes(1);
      expect(mocks.publicGet.mock.calls[0]?.[0]).toBe('/venues');
      expect(screen.getByText('3 espaços')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Buscar quadras' }),
      ).toBeInTheDocument();
    });
  });

  describe('API call', () => {
    it('never lets Next cache the search (free times go stale in minutes)', async () => {
      await renderPage({ sport: 'padel' });

      expect(mocks.publicGet.mock.calls[0]?.[2]).toEqual({ revalidate: 0 });
    });

    it('forwards the filters and the page', async () => {
      await renderPage({
        q: ' vila   madalena ',
        sport: 'padel',
        page: '2',
      });

      const path = mocks.publicGet.mock.calls[0]?.[0] as string;
      const query = new URLSearchParams(path.split('?')[1]);
      expect(path.startsWith('/venues?')).toBe(true);
      expect(query.get('q')).toBe('vila   madalena');
      expect(query.get('sport')).toBe('padel');
      expect(query.get('page')).toBe('2');
    });

    it('shows an error, not a crash, when the API fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.publicGet.mockRejectedValue(new Error('boom'));

      await renderPage({ q: 'vila' });

      expect(messages()).toEqual([
        'Não foi possível carregar os espaços agora.',
      ]);
    });

    it('treats a 404 from the API like a failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.publicGet.mockResolvedValue(null);

      await renderPage();

      expect(messages()).toHaveLength(1);
    });
  });

  describe('results', () => {
    it('writes "1 espaço" in the singular', async () => {
      mocks.publicGet.mockResolvedValue(response(1));
      await renderPage({ q: 'vila' });

      expect(screen.getByText('1 espaço')).toBeInTheDocument();
    });

    it('writes "N espaços" in the plural and heads the page with the query', async () => {
      mocks.publicGet.mockResolvedValue(response(12));
      await renderPage({ q: 'vila madalena' });

      expect(screen.getByText('12 espaços')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Quadras em vila madalena',
        }),
      ).toBeInTheDocument();
    });

    it('does not invent a total when there is more: "Mais de N espaços"', async () => {
      mocks.publicGet.mockResolvedValue(response(20, true));
      await renderPage();

      expect(screen.getByText('Mais de 20 espaços')).toBeInTheDocument();
    });

    it('counts what was already passed on page 2 and says "Página 2"', async () => {
      mocks.publicGet.mockResolvedValue(response(5, false, 2));
      await renderPage({ q: 'vila', page: '2' });

      expect(screen.getByText('25 espaços')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: /Página 2/ }),
      ).toBeInTheDocument();
    });

    it('renders a card per venue linking to the venue page', async () => {
      mocks.publicGet.mockResolvedValue(response(3));
      await renderPage();

      const list = screen.getByRole('list', { name: 'Espaços encontrados' });
      expect(within(list).getAllByRole('link')).toHaveLength(3);
      expect(
        within(list).getByRole('link', { name: 'Arena 2' }),
      ).toHaveAttribute('href', '/espacos/arena-2');
    });

    it('shows the distance on the cards when searching near a point', async () => {
      mocks.publicGet.mockResolvedValue({
        ...response(1),
        items: [card(1, 1.2)],
      });
      await renderPage({ lat: '-23.550', lng: '-46.690' });

      expect(screen.getByText(/ · 1,2 km$/)).toBeInTheDocument();
    });

    it('mounts the map when there are results', async () => {
      await renderPage();

      expect(screen.getByTestId('map-stub')).toBeInTheDocument();
    });
  });

  describe('"Carregar mais"', () => {
    it('is a link to page+1 that keeps the filters, only when hasMore', async () => {
      mocks.publicGet.mockResolvedValue(response(20, true));
      await renderPage({ q: 'vila', sport: 'padel', lat: '', page: '2' });

      expect(
        screen.getByRole('link', { name: 'Carregar mais' }),
      ).toHaveAttribute('href', '/buscar?q=vila&sport=padel&page=3');
    });

    it('goes from page 1 to page 2', async () => {
      mocks.publicGet.mockResolvedValue(response(20, true));
      await renderPage({ sport: 'futsal' });

      expect(
        screen.getByRole('link', { name: 'Carregar mais' }),
      ).toHaveAttribute('href', '/buscar?sport=futsal&page=2');
    });

    it('is absent without hasMore', async () => {
      mocks.publicGet.mockResolvedValue(response(5, false));
      await renderPage();

      expect(
        screen.queryByRole('link', { name: 'Carregar mais' }),
      ).not.toBeInTheDocument();
    });

    it('is absent on the last page the API accepts', async () => {
      mocks.publicGet.mockResolvedValue(response(20, true, 50));
      await renderPage({ page: '50' });

      expect(
        screen.queryByRole('link', { name: 'Carregar mais' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('no results', () => {
    it('shows the empty state with a link to all venues and no map', async () => {
      mocks.publicGet.mockResolvedValue(response(0));
      await renderPage({ q: 'nada por aqui' });

      expect(
        screen.getByRole('heading', { name: 'Nenhum espaço encontrado' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Ver todos os espaços' }),
      ).toHaveAttribute('href', '/buscar');
      expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
      expect(screen.queryByText(/^\d+ espaços?$/)).not.toBeInTheDocument();
    });
  });

  describe('filters, date and players', () => {
    it('forwards amenities and maxPrice to the API', async () => {
      await renderPage({ amenities: 'coberta,vestiario', maxPrice: '200' });

      const path = mocks.publicGet.mock.calls[0]?.[0] as string;
      const query = new URLSearchParams(path.split('?')[1]);
      expect(query.get('amenities')).toBe('coberta,vestiario');
      expect(query.get('maxPrice')).toBe('200');
    });

    it('ignores a date in the past and a player count out of range, without an error', async () => {
      await renderPage({ data: '2020-01-01', jogadores: '99' });

      expect(messages()).toEqual([]);
      const list = screen.getByRole('list', { name: 'Espaços encontrados' });
      expect(
        within(list).getByRole('link', { name: 'Arena 2' }),
      ).toHaveAttribute('href', '/espacos/arena-2');
    });

    it('carries date and players on every venue link', async () => {
      const day = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await renderPage({ data: day, jogadores: '14' });

      const list = screen.getByRole('list', { name: 'Espaços encontrados' });
      expect(
        within(list).getByRole('link', { name: 'Arena 2' }),
      ).toHaveAttribute('href', `/espacos/arena-2?data=${day}&jogadores=14`);
    });

    it('refuses an unknown amenity with the schema message', async () => {
      await renderPage({ amenities: 'piscina' });

      expect(messages()).toEqual(['Comodidade inválida']);
      expect(mocks.publicGet).not.toHaveBeenCalled();
    });
  });

  describe('free today counter', () => {
    it('counts the venues with a nextFreeTime', async () => {
      mocks.publicGet.mockResolvedValue({
        ...response(3),
        items: [
          { ...card(1), nextFreeTime: '20:00', freeTimes: ['20:00'] },
          { ...card(2), nextFreeTime: '21:30', freeTimes: ['21:30'] },
          card(3),
        ],
      });
      await renderPage();

      expect(
        screen.getByText('2 quadras com horário livre hoje'),
      ).toBeInTheDocument();
      expect(screen.getByText('3 espaços')).toBeInTheDocument();
    });

    it('uses the singular for one', async () => {
      mocks.publicGet.mockResolvedValue({
        ...response(2),
        items: [
          { ...card(1), nextFreeTime: '20:00', freeTimes: ['20:00'] },
          card(2),
        ],
      });
      await renderPage();

      expect(
        screen.getByText('1 quadra com horário livre hoje'),
      ).toBeInTheDocument();
    });

    it('says nothing about free times when none is free (no made-up zero)', async () => {
      await renderPage();

      expect(screen.queryByText(/horário livre/)).not.toBeInTheDocument();
      expect(screen.getByText('3 espaços')).toBeInTheDocument();
    });
  });

  describe('what the page no longer has', () => {
    it('leaves the search bar and the pills to the sticky header', async () => {
      await renderPage({ amenities: 'coberta' });

      expect(screen.queryByRole('search')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Coberta' }),
      ).not.toBeInTheDocument();
    });

    it('still explains an empty result, with the way back', async () => {
      mocks.publicGet.mockResolvedValue(response(0));
      await renderPage({ amenities: 'coberta' });

      expect(
        screen.getByRole('heading', { name: 'Nenhum espaço encontrado' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/tire algum filtro/)).toBeInTheDocument();
    });
  });

  describe('free time chips', () => {
    it('lists the venue free times as chips to the venue page, today, with the time and players', async () => {
      mocks.publicGet.mockResolvedValue({
        ...response(1),
        items: [
          { ...card(1), nextFreeTime: '20:00', freeTimes: ['20:00', '21:00'] },
        ],
      });
      await renderPage({ jogadores: '14', data: '2099-01-01' });

      const chip = screen.getByRole('link', { name: '20:00, Arena 1' });
      const href = chip.getAttribute('href') ?? '';
      const url = new URL(href, 'http://x');
      expect(url.pathname).toBe('/espacos/arena-1');
      expect(url.searchParams.get('hora')).toBe('20:00');
      expect(url.searchParams.get('jogadores')).toBe('14');
      // Today in São Paulo, not the searched day.
      expect(url.searchParams.get('data')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        screen.getByRole('link', { name: '21:00, Arena 1' }),
      ).toBeVisible();
    });

    it('has no chips for a venue with nothing free today', async () => {
      await renderPage();

      expect(
        screen.queryByRole('list', { name: /Horários livres/ }),
      ).toBeNull();
    });
  });

  describe('generateMetadata', () => {
    it('titles the page "Quadras em {q}" when there is a query', async () => {
      const metadata = await generateMetadata(props({ q: 'vila  madalena' }));

      expect(metadata.title).toBe('Quadras em vila madalena');
    });

    it('titles it "Buscar quadras" otherwise, also for empty or invalid params', async () => {
      expect((await generateMetadata(props({}))).title).toBe('Buscar quadras');
      expect((await generateMetadata(props({ q: '' }))).title).toBe(
        'Buscar quadras',
      );
      expect((await generateMetadata(props({ q: 'a' }))).title).toBe(
        'Buscar quadras',
      );
    });

    it('tells pages apart', async () => {
      const metadata = await generateMetadata(props({ q: 'vila', page: '2' }));

      expect(metadata.title).toBe('Quadras em vila · Página 2');
    });
  });
});
