import type { PublicVenueCard } from '@arenaz/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MapProps {
  items: PublicVenueCard[];
  hoveredSlug: string | null;
  previewSlug: string | null;
  onPreview: (slug: string | null) => void;
  hrefFor: (slug: string) => string;
}

const captured = vi.hoisted(() => ({
  props: null as MapProps | null,
  demo: false,
}));

// The demo mode is read at import time; a getter lets each test pick it.
vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return captured.demo;
    },
    demoVenueExtras: (slug: string) =>
      captured.demo ? (fixtures.DEMO_VENUE_EXTRAS[slug] ?? null) : null,
  };
});

// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: MapProps) {
      captured.props = props;
      return (
        <div
          data-testid="map-stub"
          data-hovered={props.hoveredSlug ?? ''}
          data-preview={props.previewSlug ?? ''}
        />
      );
    },
}));

import { ResultsList } from './results-list';

function venue(index: number): PublicVenueCard {
  return {
    slug: `arena-${String(index)}`,
    name: `Arena ${String(index)}`,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: null,
    coverSrcSet: null,
    sports: ['futsal'],
    minPriceCentsPerHour: 18000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm: null,
    nextFreeTime: null,
  };
}

const ITEMS = [venue(1), venue(2), venue(3)];

describe('ResultsList', () => {
  beforeEach(() => {
    captured.props = null;
    captured.demo = false;
  });

  it('lists a card per venue', () => {
    render(<ResultsList items={ITEMS} />);

    const list = screen.getByRole('list', { name: 'Espaços encontrados' });
    expect(within(list).getAllByRole('link')).toHaveLength(3);
  });

  it('sizes the card covers to the results grid', () => {
    render(
      <ResultsList
        items={[
          {
            ...venue(9),
            coverUrl: 'http://img.test/9.jpg',
            coverSrcSet: 'http://img.test/9.w400.webp 400w',
          },
        ]}
      />,
    );

    const img = screen
      .getByRole('list', { name: 'Espaços encontrados' })
      .querySelector('img');
    expect(img).toHaveAttribute('srcset', 'http://img.test/9.w400.webp 400w');
    expect(img).toHaveAttribute(
      'sizes',
      '(min-width: 1360px) 257px, (min-width: 1235px) calc(22vw - 42px), (min-width: 1024px) calc(33vw - 52px), (min-width: 640px) calc(50vw - 26px), calc(100vw - 32px)',
    );
  });

  it('renders the footer after the cards', () => {
    render(
      <ResultsList items={ITEMS} footer={<a href="/x">Carregar mais</a>} />,
    );

    expect(screen.getByRole('link', { name: 'Carregar mais' })).toBeVisible();
  });

  it('renders the header above the cards and hides it with the list on a phone', async () => {
    render(<ResultsList items={ITEMS} header={<h1>Quadras</h1>} />);

    const header = screen.getByTestId('results-header');
    expect(header).toContainElement(screen.getByRole('heading'));
    expect(header).not.toHaveClass('hidden');

    await userEvent.click(screen.getByRole('button', { name: 'Mapa' }));

    expect(header).toHaveClass('hidden');
  });

  describe('pin highlight and preview', () => {
    it('starts with nothing highlighted and no preview', () => {
      render(<ResultsList items={ITEMS} />);

      expect(captured.props?.hoveredSlug).toBeNull();
      expect(captured.props?.previewSlug).toBeNull();
    });

    it('highlights the pin of the card the mouse is over, without a preview', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.hover(screen.getByRole('link', { name: 'Arena 2' }));

      expect(screen.getByTestId('map-stub')).toHaveAttribute(
        'data-hovered',
        'arena-2',
      );
      expect(screen.getByTestId('map-stub')).toHaveAttribute(
        'data-preview',
        '',
      );
    });

    it('lets go of the highlight when the mouse leaves the card', async () => {
      render(<ResultsList items={ITEMS} />);
      const card = screen.getByRole('link', { name: 'Arena 2' });

      await userEvent.hover(card);
      await userEvent.unhover(card);

      expect(captured.props?.hoveredSlug).toBeNull();
    });

    it('highlights the pin of the card that gets keyboard focus, without a preview', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.tab();
      expect(captured.props?.hoveredSlug).toBe('arena-1');
      // Card link, its "show on the map" button, then the next card.
      await userEvent.tab();
      expect(captured.props?.hoveredSlug).toBe('arena-1');
      await userEvent.tab();
      expect(captured.props?.hoveredSlug).toBe('arena-2');
      expect(captured.props?.previewSlug).toBeNull();
    });

    it('lets go of the highlight when the card loses focus', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.tab();
      act(() => {
        (document.activeElement as HTMLElement).blur();
      });

      expect(captured.props?.hoveredSlug).toBeNull();
    });

    it('keeps the highlight while the card is still focused after the mouse leaves', async () => {
      render(<ResultsList items={ITEMS} />);
      const card = screen.getByRole('link', { name: 'Arena 1' });

      await userEvent.tab();
      await userEvent.hover(card);
      await userEvent.unhover(card);

      expect(captured.props?.hoveredSlug).toBe('arena-1');
    });

    it('opens the preview only when a pin is clicked, and closes it', () => {
      render(<ResultsList items={ITEMS} />);

      act(() => {
        captured.props?.onPreview('arena-3');
      });
      expect(captured.props?.previewSlug).toBe('arena-3');
      expect(captured.props?.hoveredSlug).toBeNull();

      act(() => {
        captured.props?.onPreview(null);
      });
      expect(captured.props?.previewSlug).toBeNull();
    });

    it('keeps the preview open while cards are hovered', async () => {
      render(<ResultsList items={ITEMS} />);
      act(() => {
        captured.props?.onPreview('arena-3');
      });

      await userEvent.hover(screen.getByRole('link', { name: 'Arena 1' }));
      await userEvent.unhover(screen.getByRole('link', { name: 'Arena 1' }));

      expect(captured.props?.previewSlug).toBe('arena-3');
    });
  });

  describe('card to map', () => {
    const mapButton = (n: number) =>
      screen.getByRole('button', {
        name: `Mostrar Arena ${String(n)} no mapa`,
      });

    it('has a "Mostrar ... no mapa" button per card, none pressed', () => {
      render(<ResultsList items={ITEMS} />);

      for (const n of [1, 2, 3]) {
        expect(mapButton(n)).toHaveAttribute('aria-pressed', 'false');
      }
    });

    it('selecting a card darkens its pin and opens the preview, leaving the others', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.click(mapButton(2));

      expect(captured.props?.previewSlug).toBe('arena-2');
      expect(mapButton(2)).toHaveAttribute('aria-pressed', 'true');
      expect(mapButton(1)).toHaveAttribute('aria-pressed', 'false');
    });

    it('selecting another card moves the selection, and the same one again clears it', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.click(mapButton(1));
      await userEvent.click(mapButton(3));
      expect(captured.props?.previewSlug).toBe('arena-3');
      expect(mapButton(1)).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(mapButton(3));
      expect(captured.props?.previewSlug).toBeNull();
    });

    it('a pin selected on the map presses the card button', () => {
      render(<ResultsList items={ITEMS} />);

      act(() => {
        captured.props?.onPreview('arena-3');
      });

      expect(mapButton(3)).toHaveAttribute('aria-pressed', 'true');
    });

    it('on a phone it takes you from the list to the map, and moves focus to "Mapa"', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.click(mapButton(2));

      expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByTestId('results-list-view')).toHaveClass('hidden');
      expect(screen.getByRole('button', { name: 'Mapa' })).toHaveFocus();
    });

    it('does not select by merely following the card link', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.hover(screen.getByRole('link', { name: 'Arena 1' }));

      expect(captured.props?.previewSlug).toBeNull();
    });
  });

  describe('date and players of the search', () => {
    it('go on every card link', () => {
      render(
        <ResultsList
          items={ITEMS}
          intent={{ data: '2026-10-30', jogadores: '14' }}
        />,
      );

      const list = screen.getByRole('list', { name: 'Espaços encontrados' });
      for (const link of within(list).getAllByRole('link')) {
        expect(link.getAttribute('href')).toMatch(
          /^\/espacos\/arena-\d\?data=2026-10-30&jogadores=14$/,
        );
      }
    });

    it('go to the preview of the map too', () => {
      render(
        <ResultsList
          items={ITEMS}
          intent={{ data: '2026-10-30', jogadores: '14' }}
        />,
      );

      expect(captured.props?.hrefFor('arena-2')).toBe(
        '/espacos/arena-2?data=2026-10-30&jogadores=14',
      );
    });

    it('leave the links plain when the search has neither', () => {
      render(<ResultsList items={ITEMS} />);

      expect(screen.getByRole('link', { name: 'Arena 1' })).toHaveAttribute(
        'href',
        '/espacos/arena-1',
      );
      expect(captured.props?.hrefFor('arena-1')).toBe('/espacos/arena-1');
    });
  });

  describe('what a card shows', () => {
    it('shows "Livre às 20h" from nextFreeTime, and nothing without it', () => {
      render(
        <ResultsList
          items={[{ ...venue(1), nextFreeTime: '20:00' }, venue(2)]}
        />,
      );

      expect(screen.getAllByText(/Livre às/)).toHaveLength(1);
      expect(screen.getByText('Livre às 20h')).toBeInTheDocument();
    });

    it('has no rating, badge or heart outside the demo mode', () => {
      render(
        <ResultsList items={[{ ...venue(1), slug: 'arena-vila-madalena' }]} />,
      );

      expect(screen.queryByTestId('venue-card-rating')).toBeNull();
      expect(screen.queryByTestId('venue-card-badge')).toBeNull();
      expect(screen.queryByText(/4,92/)).toBeNull();
      expect(
        screen.queryByRole('button', { name: /favoritos/ }),
      ).not.toBeInTheDocument();
    });

    it('shows the rating of the demo fixtures in the demo mode, no heart, no hole for a venue without one', () => {
      captured.demo = true;
      render(
        <ResultsList
          items={[{ ...venue(1), slug: 'arena-vila-madalena' }, venue(2)]}
        />,
      );

      expect(screen.getAllByTestId('venue-card-rating')).toHaveLength(1);
      expect(screen.getByTestId('venue-card-rating')).toHaveTextContent('4,92');
      expect(
        screen.queryByRole('button', { name: /favoritos/ }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(2);
    });

    it('degrades cleanly: no photo, no free time and a 40+ character name', () => {
      const name =
        'Complexo Esportivo Municipal Professor Doutor Fulano de Tal';
      render(<ResultsList items={[{ ...venue(1), name }]} />);

      const list = screen.getByRole('list', { name: 'Espaços encontrados' });
      expect(within(list).getByRole('link', { name })).toBeInTheDocument();
      expect(screen.getByTestId('venue-card-fallback')).toBeInTheDocument();
      expect(screen.queryByText(/Livre às/)).toBeNull();
      expect(screen.getByText(name).className).toContain('line-clamp-2');
    });
  });

  describe('mobile view toggle', () => {
    it('shows the list first: "Lista" pressed, "Mapa" not', () => {
      render(<ResultsList items={ITEMS} />);

      expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.getByTestId('results-list-view')).not.toHaveClass('hidden');
      expect(screen.getByTestId('results-map-view')).toHaveClass('hidden');
    });

    it('switches the view and the pressed button, and back', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.click(screen.getByRole('button', { name: 'Mapa' }));

      expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.getByTestId('results-list-view')).toHaveClass('hidden');
      expect(screen.getByTestId('results-map-view')).not.toHaveClass('hidden');

      await userEvent.click(screen.getByRole('button', { name: 'Lista' }));

      expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByTestId('results-map-view')).toHaveClass('hidden');
    });
  });
});
