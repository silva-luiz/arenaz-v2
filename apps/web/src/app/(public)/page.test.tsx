import type { Availability, PublicVenueCard } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publicGet: vi.fn(),
  apiSend: vi.fn(),
  demo: { on: false },
}));
// `connection()` only works inside a real request.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/public-api', () => ({ publicGet: mocks.publicGet }));
vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
// The demo mode is read at import time; a getter lets each test pick it.
vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return mocks.demo.on;
    },
    demoVenueExtras: (slug: string) =>
      mocks.demo.on ? (fixtures.DEMO_VENUE_EXTRAS[slug] ?? null) : null,
    get demoOpenGames() {
      return mocks.demo.on ? fixtures.DEMO_OPEN_GAMES : [];
    },
    demoMarketingCounters: fixtures.DEMO_MARKETING_COUNTERS,
    missingLabel: (count: number) =>
      count === 1 ? 'Falta 1' : `Faltam ${String(count)}`,
  };
});

import HomePage, { metadata } from './page';

function card(
  slug: string,
  overrides: Partial<PublicVenueCard> = {},
): PublicVenueCard {
  return {
    slug,
    name: `Nome ${slug}`,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: `http://img.test/${slug}.jpg`,
    coverSrcSet: null,
    sports: ['futebol_society'],
    minPriceCentsPerHour: 18000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm: null,
    nextFreeTime: '20:00',
    freeTimes: ['20:00'],
    ...overrides,
  };
}

function page(items: PublicVenueCard[]) {
  return { items, page: 1, pageSize: 20, hasMore: false };
}

const FIELD_A = '11111111-1111-4111-8111-111111111111';
const FIELD_B = '22222222-2222-4222-8222-222222222222';

/** 15:00 in São Paulo. */
const NOW = new Date('2026-10-29T18:00:00Z');

function slot(startsAt: string, available: boolean) {
  const end = new Date(Date.parse(startsAt) + 3_600_000).toISOString();
  return { startsAt, endsAt: end, available, priceCents: 18000 };
}

const AVAILABILITY: Availability = {
  date: '2026-10-29',
  timezone: 'America/Sao_Paulo',
  fields: [
    {
      id: FIELD_A,
      name: 'Society 1',
      minSlotMinutes: 60,
      slots: [
        slot('2026-10-29T17:00:00.000Z', true), // 14:00, already past
        slot('2026-10-29T21:00:00.000Z', true), // 18:00
        slot('2026-10-29T22:00:00.000Z', false), // 19:00 taken here...
        slot('2026-10-29T23:00:00.000Z', true), // 20:00
      ],
    },
    {
      id: FIELD_B,
      name: 'Society 2',
      minSlotMinutes: 90,
      slots: [
        slot('2026-10-29T22:00:00.000Z', true), // ...but free here
        slot('2026-10-30T00:00:00.000Z', true), // 21:00
      ],
    },
  ],
};

let society: PublicVenueCard[];
let weekend: Record<string, PublicVenueCard[]>;

function route(path: string) {
  if (path.startsWith('/venues?sport=futebol_society')) return page(society);
  const sport = /^\/venues\?sport=(\w+)$/.exec(path)?.[1];
  if (sport) return page(weekend[sport] ?? []);
  if (path.startsWith('/venues/')) return AVAILABILITY;
  throw new Error(`rota inesperada: ${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no matchMedia; the hero and rails ask for reduced motion.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocks.demo.on = false;
  society = [
    card('arena-vila-madalena', {
      name: 'Arena Vila Madalena',
      nextFreeTime: '20:00',
    }),
    card('society-pinheiros', {
      name: 'Society Pinheiros',
      nextFreeTime: '19:30',
    }),
    card('sem-horario', { name: 'Sem Horário Hoje', nextFreeTime: null }),
  ];
  weekend = {
    futevolei: [
      card('futevolei-praia-urbana', {
        name: 'Futevôlei Praia Urbana',
        sports: ['futevolei'],
      }),
    ],
    padel: [
      card('padel-pinheiros', { name: 'Padel Pinheiros', sports: ['padel'] }),
    ],
    beach_tennis: [
      card('beach-lapa-sunset', {
        name: 'Beach Lapa Sunset',
        sports: ['beach_tennis', 'volei_praia'],
        nextFreeTime: null,
      }),
    ],
    volei_praia: [
      // Also a beach tennis venue: shown once.
      card('beach-lapa-sunset', {
        name: 'Beach Lapa Sunset',
        sports: ['beach_tennis', 'volei_praia'],
        nextFreeTime: null,
      }),
    ],
    tenis: [
      card('saibro-butanta', { name: 'Saibro Butantã', sports: ['tenis'] }),
    ],
  };
  mocks.publicGet.mockImplementation((path: string) =>
    Promise.resolve(route(path)),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

function region(name: string | RegExp) {
  return screen.getByRole('region', { name });
}

describe('home page: hero and search', () => {
  it('shows the night hero title (one h1) and the hero photo', async () => {
    render(await HomePage());

    const titles = screen.getAllByRole('heading', { level: 1 });
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveAccessibleName('Bora jogar hoje à noite?');
    expect(
      screen.getByRole('img', {
        name: 'Campo de futebol iluminado por um refletor à noite, com jogadores em campo',
      }),
    ).toHaveAttribute('src', '/home/hero-night.jpg');
  });

  it('has the search pill with Onde, Quando, Esporte and Jogadores', async () => {
    render(await HomePage());

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('action', '/buscar');
    expect(within(form).getByRole('textbox', { name: 'Onde' })).toBeVisible();
    for (const name of ['Quando', 'Esporte', 'Jogadores']) {
      expect(within(form).getByRole('combobox', { name })).toBeVisible();
    }
    expect(within(form).getByRole('button', { name: 'Buscar' })).toBeVisible();
  });

  it('submits q, sport, data (YYYY-MM-DD) and jogadores to /buscar', async () => {
    const user = userEvent.setup();
    render(await HomePage());

    const form = screen.getByRole<HTMLFormElement>('search');
    let sent: Record<string, FormDataEntryValue> = {};
    const onSubmit = (event: Event) => {
      event.preventDefault();
      sent = Object.fromEntries(new FormData(form).entries());
    };
    document.addEventListener('submit', onSubmit);

    await user.type(within(form).getByLabelText('Onde'), 'Pinheiros');
    await user.selectOptions(within(form).getByLabelText('Quando'), 'Hoje');
    await user.selectOptions(within(form).getByLabelText('Esporte'), 'Padel');
    await user.selectOptions(
      within(form).getByLabelText('Jogadores'),
      '4 pessoas',
    );
    await user.click(within(form).getByRole('button', { name: 'Buscar' }));

    expect(form).toHaveAttribute('action', '/buscar');
    expect(sent).toEqual({
      q: 'Pinheiros',
      data: '2026-10-29',
      sport: 'padel',
      jogadores: '4',
    });
    document.removeEventListener('submit', onSubmit);
  });

  it('keeps the floating marketing cards (no fake data about a venue)', async () => {
    render(await HomePage());

    expect(screen.getByText('Reserva confirmada')).toBeInTheDocument();
    expect(screen.getByText('Racha no Pix')).toBeInTheDocument();
  });

  it('shows the "312 quadras" counter only in the demo mode', async () => {
    render(await HomePage());
    expect(screen.queryByText(/quadras com horário livre hoje/)).toBeNull();

    mocks.demo.on = true;
    render(await HomePage());
    expect(
      screen.getByText('312 quadras com horário livre hoje'),
    ).toBeInTheDocument();
  });

  it('has the mobile "Bora jogar?" pill leading to the search of the sport', async () => {
    render(await HomePage());

    const pill = screen.getByRole('link', { name: /^Bora jogar\?/ });
    expect(pill).toHaveAttribute('href', '/buscar?sport=futebol_society');
    expect(pill).toHaveTextContent('Qualquer lugar · hoje · Society');
    expect(pill).toHaveClass('md:hidden');
  });
});

describe('home page: sports and "livre hoje à noite"', () => {
  it('shows the sports as toggle buttons with a photo, Society pressed', async () => {
    render(await HomePage());

    const group = screen.getByRole('group', { name: 'Esportes' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Society',
      'Futsal',
      'Campo',
      'Futevôlei',
      'Beach tennis',
      'Padel',
      'Tênis',
      'Coberta',
    ]);
    for (const button of buttons) {
      expect(button.querySelector('img')).toHaveAttribute(
        'src',
        expect.stringMatching(/^\/esportes\/\w+\.jpg$/),
      );
      expect(button).toHaveClass('min-w-11');
    }
    expect(
      within(group).getByRole('button', { name: 'Society' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(group).getByRole('button', { name: 'Futsal' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks the API for the society venues and the weekend sports', async () => {
    render(await HomePage());

    const paths = mocks.publicGet.mock.calls.map((call) => call[0] as string);
    expect(paths).toContain('/venues?sport=futebol_society');
    for (const sport of [
      'futevolei',
      'padel',
      'beach_tennis',
      'tenis',
      'volei_praia',
    ]) {
      expect(paths).toContain(`/venues?sport=${sport}`);
    }
  });

  it('lists the venues free tonight with the "Livre às" seal, earliest first', async () => {
    render(await HomePage());

    const tonight = region('Society livre hoje à noite, perto de você');
    const names = within(tonight)
      .getAllByRole('link', { name: /Arena|Pinheiros|Horário/ })
      .map((link) => link.textContent);
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('Society Pinheiros');
    expect(names[1]).toContain('Arena Vila Madalena');
    expect(within(tonight).getByText('Livre às 19h30')).toBeInTheDocument();
    expect(within(tonight).getByText('Livre às 20h')).toBeInTheDocument();
    expect(within(tonight).queryByText('Sem Horário Hoje')).toBeNull();
    expect(
      within(tonight).getByRole('link', {
        name: 'Society livre hoje à noite, perto de você',
      }),
    ).toHaveAttribute('href', '/buscar?sport=futebol_society');
  });

  it('falls back to every venue, without seals, when none is free today', async () => {
    society = society.map((venue) => ({ ...venue, nextFreeTime: null }));
    render(await HomePage());

    // Desktop rail and mobile card share the heading.
    const [rail, mobile] = screen.getAllByRole('region', {
      name: 'Society para reservar',
    });
    if (!rail || !mobile) throw new Error('faltou uma seção');
    expect(within(rail).getByText('Sem Horário Hoje')).toBeInTheDocument();
    expect(within(rail).queryByText(/Livre às/)).toBeNull();
    // Nothing free today: the mobile card has no times to offer.
    expect(within(mobile).queryByRole('list')).toBeNull();
    expect(screen.queryByText(/livre hoje à noite/)).toBeNull();
  });

  it('swaps the rail when another sport is pressed', async () => {
    const user = userEvent.setup();
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.includes('/availability')
          ? { ok: true, data: AVAILABILITY }
          : {
              ok: true,
              data: page([
                card('pacaembu-futsal-club', {
                  name: 'Pacaembu Futsal Club',
                  sports: ['futsal'],
                  nextFreeTime: '21:30',
                }),
              ]),
            },
      ),
    );
    render(await HomePage());

    const group = screen.getByRole('group', { name: 'Esportes' });
    await user.click(within(group).getByRole('button', { name: 'Futsal' }));

    expect(mocks.apiSend).toHaveBeenCalledWith(
      'GET',
      '/venues?sport=futsal',
      undefined,
      expect.anything(),
    );
    const tonight = await screen.findByRole('region', {
      name: 'Futsal livre hoje à noite, perto de você',
    });
    expect(
      within(tonight).getByRole('link', { name: 'Pacaembu Futsal Club' }),
    ).toHaveAttribute('href', '/espacos/pacaembu-futsal-club');
    expect(within(tonight).getByText('Livre às 21h30')).toBeInTheDocument();
    expect(
      within(group).getByRole('button', { name: 'Futsal' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // The mobile card loads the times of its new venue in the browser.
    const now = screen.getByRole('region', {
      name: 'Livre agora perto de você',
    });
    expect(
      await within(now).findByRole('link', {
        name: 'Reservar Pacaembu Futsal Club às 18:00',
      }),
    ).toBeInTheDocument();
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'GET',
      '/venues/pacaembu-futsal-club/availability?date=2026-10-29',
      undefined,
      expect.anything(),
    );
    expect(
      within(group).getByRole('button', { name: 'Society' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks for covered venues with "Coberta" (an amenity, not a sport)', async () => {
    const user = userEvent.setup();
    mocks.apiSend.mockResolvedValue({ ok: true, data: page([]) });
    render(await HomePage());

    await user.click(screen.getByRole('button', { name: 'Coberta' }));

    expect(mocks.apiSend).toHaveBeenCalledWith(
      'GET',
      '/venues?amenities=coberta',
      undefined,
      expect.anything(),
    );
    expect(
      await screen.findAllByText('Ainda não há espaços de Coberta por aqui.'),
    ).not.toHaveLength(0);
  });

  it('says so when a sport cannot be loaded, and can go back', async () => {
    const user = userEvent.setup();
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 0,
      fieldErrors: {},
      message: 'x',
    });
    render(await HomePage());

    await user.click(screen.getByRole('button', { name: 'Padel' }));
    expect(
      (
        await screen.findAllByText(
          'Não foi possível carregar os espaços agora.',
        )
      ).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Society' }));
    expect(
      region('Society livre hoje à noite, perto de você'),
    ).toBeInTheDocument();
    // Society came from the server: no second request.
    expect(mocks.apiSend).toHaveBeenCalledTimes(1);
  });

  it('passes nextFreeTime to the cards and degrades without photo or with a long name', async () => {
    society = [
      card('nome-longo', {
        name: 'Arena Poliesportiva Comunitária do Jardim das Flores',
        coverUrl: null,
        nextFreeTime: '22:00',
      }),
    ];
    render(await HomePage());

    const tonight = region('Society livre hoje à noite, perto de você');
    const link = within(tonight).getByRole('link', {
      name: 'Arena Poliesportiva Comunitária do Jardim das Flores',
    });
    expect(within(link).getByTestId('venue-card-fallback')).toBeInTheDocument();
    expect(within(link).getByText('Livre às 22h')).toBeInTheDocument();
  });
});

describe('home page: photo sizes', () => {
  it('sizes the covers to the rail columns and to the big mobile card', async () => {
    society = [
      card('arena-vila-madalena', {
        name: 'Arena Vila Madalena',
        coverSrcSet: 'http://img.test/a.w400.webp 400w',
      }),
    ];
    render(await HomePage());

    const rail = region('Society livre hoje à noite, perto de você');
    const railImg = rail.querySelector('img');
    expect(railImg).toHaveAttribute(
      'src',
      'http://img.test/arena-vila-madalena.jpg',
    );
    expect(railImg).toHaveAttribute(
      'srcset',
      'http://img.test/a.w400.webp 400w',
    );
    expect(railImg).toHaveAttribute(
      'sizes',
      '(min-width: 1360px) 195px, (min-width: 1101px) calc(16.67vw - 32px), (min-width: 768px) calc(33.33vw - 41px), calc(78vw - 25px)',
    );
    const big = region('Livre agora perto de você').querySelector('img');
    expect(big).toHaveAttribute('sizes', 'calc(100vw - 32px)');
  });

  it('serves only the original while the variants are pending', async () => {
    render(await HomePage());

    const rail = region('Society livre hoje à noite, perto de você');
    expect(rail.querySelector('img')).not.toHaveAttribute('srcset');
  });
});

describe('home page: mobile "Livre agora"', () => {
  it('shows the first free venue big, with its next three free times', async () => {
    render(await HomePage());

    const now = region('Livre agora perto de você');
    expect(now).toHaveClass('md:hidden');
    expect(
      within(now).getByRole('link', { name: 'Society Pinheiros' }),
    ).toHaveAttribute('href', '/espacos/society-pinheiros');
    expect(mocks.publicGet).toHaveBeenCalledWith(
      '/venues/society-pinheiros/availability?date=2026-10-29',
      expect.anything(),
    );

    const times = within(now).getByRole('list', {
      name: 'Próximos horários livres',
    });
    const links = within(times).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      '18:00',
      '19:00',
      '20:00',
    ]);
    expect(links[0]).toHaveAccessibleName(
      'Reservar Society Pinheiros às 18:00',
    );
    const second = new URL(links[1]?.getAttribute('href') ?? '', 'http://x');
    expect(second.pathname).toBe('/espacos/society-pinheiros');
    expect(Object.fromEntries(second.searchParams)).toEqual({
      data: '2026-10-29',
      quadra: FIELD_B,
      inicio: '2026-10-29T22:00:00.000Z',
      duracao: '90',
    });
  });

  it('shows the card without times when the availability fails', async () => {
    mocks.publicGet.mockImplementation((path: string) =>
      path.includes('/availability')
        ? Promise.reject(new Error('falhou'))
        : Promise.resolve(route(path)),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(await HomePage());

    const now = region('Livre agora perto de você');
    expect(
      within(now).getByRole('link', { name: 'Society Pinheiros' }),
    ).toBeInTheDocument();
    expect(within(now).queryByRole('list')).toBeNull();
  });
});

describe('home page: weekend and owner banner', () => {
  it('lists the sand and racket venues once each', async () => {
    render(await HomePage());

    const list = region('Areia, raquete e sol pro fim de semana');
    const names = within(list)
      .getAllByRole('link', { name: /Futevôlei|Padel|Beach|Saibro/ })
      .map((link) => link.textContent);
    expect(names).toHaveLength(4);
    expect(within(list).getAllByText('Beach Lapa Sunset')).toHaveLength(1);
  });

  it('leaves the weekend section out when there is nothing to show', async () => {
    weekend = {};
    render(await HomePage());

    expect(
      screen.queryByRole('region', {
        name: 'Areia, raquete e sol pro fim de semana',
      }),
    ).toBeNull();
  });

  it('always has the owner banner pointing to /painel', async () => {
    render(await HomePage());

    const banner = region('Quadra vazia às 15h também paga as contas.');
    expect(within(banner).getByText('Para donos de quadra')).toBeVisible();
    expect(
      within(banner).getByRole('link', { name: 'Anunciar minha quadra' }),
    ).toHaveAttribute('href', '/painel');
    // The mini panel is a marketing illustration, hidden from AT.
    expect(
      within(banner)
        .getByText('Repasse no Pix às 18h')
        .closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});

describe('home page: demo mode', () => {
  it('without it: no "Falta gente", no hearts, no ratings, no badges', async () => {
    render(await HomePage());

    expect(screen.queryByText('Falta gente? Entra no jogo.')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Falta gente' })).toBeNull();
    expect(screen.queryByRole('button', { name: /favoritos/ })).toBeNull();
    expect(screen.queryByTestId('venue-card-rating')).toBeNull();
    expect(screen.queryByText('Preferido da galera')).toBeNull();
    expect(screen.queryByText(/partidas abertas/)).toBeNull();
    // The tab bar link to the section would lead nowhere.
    expect(document.getElementById('partidas')).toBeNull();
  });

  it('with it: the open games band, ratings, badges and hearts', async () => {
    mocks.demo.on = true;
    const user = userEvent.setup();
    render(await HomePage());

    const band = region('Falta gente? Entra no jogo.');
    expect(within(band).getByText('27 partidas abertas agora')).toBeVisible();
    const game = within(band).getByRole('link', {
      name: /Fut feminino de quarta/,
    });
    expect(within(game).getByText('Hoje · 21h')).toBeVisible();
    expect(within(game).getByText('Faltam 2')).toBeVisible();
    expect(within(game).getByText('R$ 15')).toBeVisible();
    expect(
      within(band).getByRole('link', { name: 'Ver todas' }),
    ).toHaveAttribute('href', '/buscar');

    const mobile = region('Falta gente');
    expect(mobile).toHaveClass('md:hidden');
    expect(
      within(mobile).getByText('Faltam 2 · R$ 15/pessoa'),
    ).toBeInTheDocument();
    expect(document.getElementById('partidas')).not.toBeNull();

    const tonight = region('Society livre hoje à noite, perto de você');
    expect(
      within(tonight).getAllByTestId('venue-card-rating')[0],
    ).toHaveTextContent('4,87');
    const weekendList = region('Areia, raquete e sol pro fim de semana');
    expect(
      within(weekendList).getAllByText('Preferido da galera'),
    ).toHaveLength(2);

    const heart = within(tonight).getAllByRole('button', {
      name: 'Salvar nos favoritos',
    })[0];
    if (!heart) throw new Error('sem coração');
    await user.click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('home page: failures', () => {
  it('survives a failing API: the rest of the page stays and a message shows', async () => {
    mocks.publicGet.mockRejectedValue(new Error('GET /api/venues falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await HomePage());

    expect(
      screen.getAllByText('Não foi possível carregar os espaços agora.')[0],
    ).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Esportes' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Anunciar minha quadra' }),
    ).toBeInTheDocument();
  });

  it('shows the empty state when there are no venues of the sport', async () => {
    society = [];
    render(await HomePage());

    expect(
      screen.getAllByText('Ainda não há espaços de Society por aqui.').length,
    ).toBeGreaterThan(0);
  });
});

describe('home page: metadata', () => {
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
