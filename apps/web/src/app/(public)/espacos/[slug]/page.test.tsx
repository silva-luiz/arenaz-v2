import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeField, makeVenue } from '@/test/venue-fixture';

const mocks = vi.hoisted(() => ({
  publicGet: vi.fn(),
  getSession: vi.fn(),
  slotPicker: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub() {
      return <div data-testid="map-stub" />;
    },
}));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
// The picker has its own tests; here only what the page hands it matters.
vi.mock('@/components/booking/slot-picker', () => ({
  SlotPicker: (props: unknown) => {
    mocks.slotPicker(props);
    return <div data-testid="picker" />;
  },
}));
vi.mock('@/lib/public-api', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/public-api')>()),
  publicGet: mocks.publicGet,
}));

import VenuePage, * as pageModule from './page';
import { generateMetadata } from './page';

function props(
  slug = 'arena-vila-madalena',
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return {
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  };
}

async function renderPage(
  slug?: string,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  render(await VenuePage(props(slug, searchParams)));
}

function jsonLd(): Record<string, unknown> {
  const script = document.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent ?? '{}') as Record<string, unknown>;
}

describe('venue page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue(makeVenue());
    mocks.getSession.mockResolvedValue(null);
  });

  it('does not export a route-segment revalidate (the route is dynamic)', () => {
    expect(pageModule).not.toHaveProperty('revalidate');
  });

  it('asks the API for the venue by slug', async () => {
    await renderPage();

    expect(mocks.publicGet).toHaveBeenCalledWith(
      '/venues/arena-vila-madalena',
      expect.anything(),
      { revalidate: 60 },
    );
  });

  it('calls notFound() when the venue does not exist', async () => {
    mocks.publicGet.mockResolvedValue(null);

    await expect(VenuePage(props('nao-existe'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('calls notFound() for a slug that cannot exist, without asking the API', async () => {
    await expect(VenuePage(props('Arena Vila%2FMadalena'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(mocks.publicGet).not.toHaveBeenCalled();
  });

  it('lets an API failure through instead of pretending the venue is gone', async () => {
    mocks.publicGet.mockRejectedValue(new Error('boom'));

    await expect(VenuePage(props())).rejects.toThrow('boom');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('shows the name, the place and the share button', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Arena Vila Madalena' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Vila Madalena, São Paulo · SP'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Compartilhar' }),
    ).toBeInTheDocument();
  });

  it('shows the gallery with a described photo each', async () => {
    await renderPage();

    expect(
      screen.getByRole('button', { name: 'Abrir foto 1 de 2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Abrir foto 2 de 2' }),
    ).toBeInTheDocument();
  });

  it('works without photos', async () => {
    mocks.publicGet.mockResolvedValue(makeVenue({ photos: [] }));

    await renderPage();

    expect(screen.queryByRole('button', { name: /Abrir foto/ })).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arena Vila Madalena' }),
    ).toBeInTheDocument();
  });

  it('shows the booking card with the lowest price across courts, rules included', async () => {
    mocks.publicGet.mockResolvedValue(
      makeVenue({
        fields: [
          makeField({
            basePriceCentsPerHour: 18000,
            priceRules: [
              {
                weekdays: [1],
                startMinute: 600,
                endMinute: 720,
                priceCentsPerHour: 9000,
                label: null,
              },
            ],
          }),
          makeField({
            id: '11111111-1111-4111-8111-111111111112',
            name: 'Quadra 2',
            basePriceCentsPerHour: 12050,
          }),
        ],
      }),
    );

    await renderPage();

    const card = screen.getByRole('complementary', { name: 'Reserva' });
    expect(card).toHaveTextContent('a partir de');
    expect(card).toHaveTextContent('R$ 90 / hora');
    expect(
      within(card).getByRole('button', { name: 'Escolher horário' }),
    ).toBeEnabled();
  });

  it('does not let a dearer rule raise the booking card price', async () => {
    mocks.publicGet.mockResolvedValue(
      makeVenue({
        fields: [
          makeField({
            basePriceCentsPerHour: 12050,
            priceRules: [
              {
                weekdays: [5],
                startMinute: 1080,
                endMinute: 1380,
                priceCentsPerHour: 30000,
                label: null,
              },
            ],
          }),
        ],
      }),
    );

    await renderPage();

    expect(
      screen.getByRole('complementary', { name: 'Reserva' }),
    ).toHaveTextContent('R$ 120,50 / hora');
  });

  it('has a single h1 and a labelled section per block', async () => {
    await renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of [
      'Sobre o espaço',
      'Comodidades',
      'Quadras',
      'Horário de funcionamento',
      'Política de cancelamento',
      'Onde fica',
    ]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  describe('booking picker', () => {
    const FIELD_ID = '11111111-1111-4111-8111-111111111111';

    // From lg up the picker sits in the card, so the stub shows what the page
    // hands it (on a phone it would be inside a closed dialog).
    beforeEach(() => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query.includes('min-width: 1024px'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function pickerProps() {
      return mocks.slotPicker.mock.lastCall?.[0] as Record<string, unknown>;
    }

    async function renderOpen(
      searchParams?: Record<string, string | string[] | undefined>,
    ) {
      mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
      await renderPage(undefined, searchParams);
    }

    it('hands the card the slug, the venue time zone and the courts', async () => {
      mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
      mocks.publicGet.mockResolvedValue(
        makeVenue({ timezone: 'America/Manaus' }),
      );
      await renderPage(undefined, {
        data: '2026-11-06',
        quadra: FIELD_ID,
        inicio: '2026-11-06T18:00:00.000-03:00',
        duracao: '60',
      });

      expect(pickerProps()).toMatchObject({
        slug: 'arena-vila-madalena',
        timezone: 'America/Manaus',
        fields: [{ id: FIELD_ID, name: 'Quadra 1', minSlotMinutes: 60 }],
        signedIn: true,
      });
    });

    it('knows an anonymous visitor', async () => {
      mocks.getSession.mockResolvedValue(null);
      await renderPage(undefined, {
        data: '2026-11-06',
        quadra: FIELD_ID,
        inicio: '2026-11-06T18:00:00.000-03:00',
        duracao: '60',
      });

      expect(pickerProps()).toMatchObject({ signedIn: false });
    });

    it('still shows the venue when the session check fails', async () => {
      mocks.getSession.mockRejectedValue(new Error('api down'));
      await renderPage(undefined, {
        data: '2026-11-06',
        quadra: FIELD_ID,
        inicio: '2026-11-06T18:00:00.000-03:00',
        duracao: '60',
      });

      expect(pickerProps()).toMatchObject({ signedIn: false });
      expect(
        screen.getByRole('heading', { level: 1, name: 'Arena Vila Madalena' }),
      ).toBeInTheDocument();
    });

    it('passes a choice made before signing in', async () => {
      await renderOpen({
        data: '2026-11-06',
        quadra: FIELD_ID,
        inicio: '2026-11-06T18:00:00.000-03:00',
        duracao: '90',
      });

      expect(pickerProps()).toMatchObject({
        initial: {
          date: '2026-11-06',
          fieldId: FIELD_ID,
          startsAt: '2026-11-06T18:00:00.000-03:00',
          durationMinutes: 90,
        },
      });
    });

    it.each([
      ['a malformed date', { data: '06/11/2026' }],
      ['an unknown court', { quadra: '99999999-9999-4999-8999-999999999999' }],
      ['a start that is not a time', { inicio: 'amanha' }],
      ['a duration that is not a number', { duracao: 'muito' }],
      ['a duration off the half hour', { duracao: '45' }],
      ['repeated parameters', { data: ['2026-11-06', '2026-11-07'] }],
    ])('ignores %s', async (_name, override) => {
      mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
      await renderPage(undefined, {
        data: '2026-11-06',
        quadra: FIELD_ID,
        inicio: '2026-11-06T18:00:00.000-03:00',
        duracao: '60',
        ...override,
      });

      expect(pickerProps().initial).toBeUndefined();
    });
  });

  describe('JSON-LD', () => {
    it('is a SportsActivityLocation with the page url', async () => {
      await renderPage();

      expect(jsonLd()).toMatchObject({
        '@type': 'SportsActivityLocation',
        name: 'Arena Vila Madalena',
        url: expect.stringMatching(/\/espacos\/arena-vila-madalena$/) as string,
      });
    });

    it('never has a street or a phone', async () => {
      await renderPage();

      const script = document.querySelector(
        'script[type="application/ld+json"]',
      );
      expect(script?.textContent).not.toMatch(/street|telephone|phone/i);
    });

    it('cannot be broken out of by a venue name', async () => {
      mocks.publicGet.mockResolvedValue(
        makeVenue({ name: '</script><img src=x onerror=alert(1)>' }),
      );

      await renderPage();

      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      expect(scripts).toHaveLength(1);
      expect(scripts[0]?.textContent).not.toContain('<');
      expect(document.querySelector('img[onerror]')).toBeNull();
    });
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue(makeVenue());
  });

  it('titles the page "{name} — {Bairro}, {Cidade} | ArenaZ", without the root suffix', async () => {
    const metadata = await generateMetadata(props());

    expect(metadata.title).toEqual({
      absolute: 'Arena Vila Madalena — Vila Madalena, São Paulo | ArenaZ',
    });
  });

  it('uses the description, squeezed into one line and cut at a reasonable size', async () => {
    mocks.publicGet.mockResolvedValue(
      makeVenue({ description: `Linha um.\nLinha dois. ${'x'.repeat(400)}` }),
    );

    const { description } = await generateMetadata(props());

    expect(description?.startsWith('Linha um. Linha dois.')).toBe(true);
    expect(description).not.toContain('\n');
    expect((description ?? '').length).toBeLessThanOrEqual(160);
    expect(description?.endsWith('…')).toBe(true);
  });

  it('falls back to a description built from the venue', async () => {
    mocks.publicGet.mockResolvedValue(makeVenue({ description: null }));

    const { description } = await generateMetadata(props());

    expect(description).toContain('Arena Vila Madalena');
    expect(description).toContain('Vila Madalena');
    expect(description).toContain('São Paulo');
  });

  it('has OpenGraph with the cover photo', async () => {
    const metadata = await generateMetadata(props());

    expect(metadata.openGraph).toMatchObject({
      title: 'Arena Vila Madalena — Vila Madalena, São Paulo | ArenaZ',
      type: 'website',
      locale: 'pt_BR',
      images: [{ url: 'http://storage.test/a.jpg' }],
    });
    expect(metadata.alternates).toEqual({
      canonical: '/espacos/arena-vila-madalena',
    });
  });

  it('uses the photo with the lowest position as the cover', async () => {
    const [first, second] = makeVenue().photos;
    if (!first || !second) throw new Error('fixture');
    mocks.publicGet.mockResolvedValue(makeVenue({ photos: [second, first] }));

    const metadata = await generateMetadata(props());

    expect(metadata.openGraph).toMatchObject({
      images: [{ url: first.url }],
    });
  });

  it('has no OpenGraph image without photos', async () => {
    mocks.publicGet.mockResolvedValue(makeVenue({ photos: [] }));

    const metadata = await generateMetadata(props());

    expect(metadata.openGraph).not.toHaveProperty('images');
  });

  it('is noindex when the venue does not exist', async () => {
    mocks.publicGet.mockResolvedValue(null);

    const metadata = await generateMetadata(props('nao-existe'));

    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.title).toBe('Espaço não encontrado');
  });

  it('is noindex for a slug that cannot exist, without asking the API', async () => {
    const metadata = await generateMetadata(props('Arena Vila%2FMadalena'));

    expect(metadata.robots).toMatchObject({ index: false });
    expect(mocks.publicGet).not.toHaveBeenCalled();
  });
});
