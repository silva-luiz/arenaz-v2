import { SPORTS } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));
// `connection()` only works inside a real request.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/public-api', () => ({ publicGet: mocks.publicGet }));

import HomePage, { metadata } from './page';

function card(index: number) {
  return {
    slug: `arena-${String(index)}`,
    name: `Arena ${String(index)}`,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: index % 2 === 0 ? `http://img.test/${String(index)}.jpg` : null,
    coverSrcSet:
      index % 2 === 0
        ? `http://img.test/${String(index)}.w400.webp 400w`
        : null,
    sports: ['futsal', 'padel'],
    minPriceCentsPerHour: 12000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm: null,
    nextFreeTime: null,
  };
}

function response(count: number) {
  return {
    items: Array.from({ length: count }, (_, index) => card(index + 1)),
    page: 1,
    pageSize: 20,
    hasMore: false,
  };
}

describe('home page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue(response(3));
  });

  it('shows the night hero with title, subtitle and the search bar', async () => {
    render(await HomePage());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Bora jogar hoje à noite?',
      }),
    ).toBeVisible();
    expect(
      screen.getByText('Reserve a quadra na hora e chame o time.'),
    ).toBeVisible();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('links every sport to /buscar?sport=<id>', async () => {
    render(await HomePage());

    const section = screen.getByRole('region', { name: 'Esportes' });
    const links = within(section).getAllByRole('link');
    expect(links).toHaveLength(SPORTS.length);
    const hrefs = links.map((link) => link.getAttribute('href'));
    for (const sport of SPORTS) {
      expect(hrefs).toContain(`/buscar?sport=${sport}`);
    }
    expect(
      within(section).getByRole('link', { name: 'Futsal' }),
    ).toHaveAttribute('href', '/buscar?sport=futsal');
  });

  it('marks the sports list as a list (list-style none drops it in Safari)', async () => {
    render(await HomePage());

    const section = screen.getByRole('region', { name: 'Esportes' });
    expect(section.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('asks the API for the newest venues (no filters)', async () => {
    render(await HomePage());

    expect(mocks.publicGet).toHaveBeenCalledTimes(1);
    expect(mocks.publicGet.mock.calls[0]?.[0]).toBe('/venues');
  });

  it('renders the venue cards in a focusable, labelled scroll list', async () => {
    render(await HomePage());

    const list = screen.getByRole('list', { name: 'Espaços em destaque' });
    expect(list).toHaveAttribute('tabindex', '0');
    const cards = within(list).getAllByRole('link');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute('href', '/espacos/arena-1');
    expect(within(list).getByRole('link', { name: 'Arena 2' })).toHaveAttribute(
      'href',
      '/espacos/arena-2',
    );
    expect(within(list).getAllByText(/^Vila Madalena · /)).toHaveLength(3);
  });

  it('sizes the card covers to the rail columns', async () => {
    render(await HomePage());

    const list = screen.getByRole('list', { name: 'Espaços em destaque' });
    const img = list.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://img.test/2.jpg');
    expect(img).toHaveAttribute('srcset', 'http://img.test/2.w400.webp 400w');
    expect(img).toHaveAttribute(
      'sizes',
      '(min-width: 1360px) 301px, (min-width: 1024px) calc(25vw - 39px), (min-width: 768px) calc(33vw - 45px), (min-width: 640px) calc(50vw - 34px), calc(78vw - 37px)',
    );
  });

  it('shows at most 8 venues', async () => {
    mocks.publicGet.mockResolvedValue(response(12));

    render(await HomePage());

    const list = screen.getByRole('list', { name: 'Espaços em destaque' });
    expect(within(list).getAllByRole('link')).toHaveLength(8);
  });

  it('shows the empty state when there are no published venues', async () => {
    mocks.publicGet.mockResolvedValue(response(0));

    render(await HomePage());

    expect(
      screen.getByText('Ainda não há espaços publicados por aqui.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Espaços em destaque' }),
    ).not.toBeInTheDocument();
  });

  it('survives a failing API: the rest of the page stays and a message shows', async () => {
    mocks.publicGet.mockRejectedValue(new Error('GET /api/venues falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await HomePage());

    // The search bar has its own (empty) alert region, so match by text.
    expect(
      screen.getByText('Não foi possível carregar os espaços agora.'),
    ).toHaveAttribute('role', 'alert');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Bora jogar hoje à noite?',
      }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'Esportes' })).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Anunciar minha quadra' }),
    ).toBeVisible();
  });

  it('has the owner banner pointing to /painel', async () => {
    render(await HomePage());

    expect(screen.getByText('Para donos de quadra')).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: 'Quadra vazia às 15h também paga as contas.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Anunciar minha quadra' }),
    ).toHaveAttribute('href', '/painel');
  });

  it('keeps the decorative lines of the owner banner away from the text', async () => {
    render(await HomePage());

    // Only where the banner is wide enough for them to sit beside the text
    // column; below that they would run under it and cost contrast.
    const banner = screen.getByText('Para donos de quadra').closest('section');
    const lines = banner?.querySelector('svg');
    expect(lines).toHaveClass('hidden', 'xl:block');
    expect(lines).not.toHaveClass('md:block');
  });

  it('exports the page metadata', () => {
    expect(metadata.title).toEqual({
      absolute: 'ArenaZ — reserve quadras perto de você',
    });
    expect(metadata.description).toEqual(expect.any(String));
    expect(metadata.openGraph).toMatchObject({
      title: 'ArenaZ — reserve quadras perto de você',
      locale: 'pt_BR',
      type: 'website',
    });
  });
});
