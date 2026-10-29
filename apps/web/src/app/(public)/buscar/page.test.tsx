import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));
// `connection()` only works inside a real request.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
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
    sports: ['futsal', 'padel'],
    minPriceCentsPerHour: 18000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm,
    nextFreeTime: null,
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

/** The search bar keeps an empty alert region of its own; only text counts. */
function messages(): string[] {
  return screen
    .getAllByRole('alert')
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
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.queryByTestId('map-stub')).not.toBeInTheDocument();
    });

    it('shows the schema message for a one-character q, keeps the value and makes no call', async () => {
      await renderPage({ q: 'a' });

      expect(messages()).toEqual([
        'A busca precisa ter pelo menos 2 caracteres',
      ]);
      expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveValue('a');
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
      expect(screen.getByRole('search')).toBeInTheDocument();
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

      expect(screen.getByText('1,2 km')).toBeInTheDocument();
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
