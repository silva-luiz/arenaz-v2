import type { PublicVenueCard } from '@arenaz/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MapProps {
  items: PublicVenueCard[];
  hoveredSlug: string | null;
  previewSlug: string | null;
  onPreview: (slug: string | null) => void;
}

const captured = vi.hoisted(() => ({ props: null as MapProps | null }));

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
  });

  it('lists a card per venue', () => {
    render(<ResultsList items={ITEMS} />);

    const list = screen.getByRole('list', { name: 'Espaços encontrados' });
    expect(within(list).getAllByRole('link')).toHaveLength(3);
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
