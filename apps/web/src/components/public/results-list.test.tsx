import type { PublicVenueCard } from '@arenaz/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MapProps {
  items: PublicVenueCard[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

const captured = vi.hoisted(() => ({ props: null as MapProps | null }));

// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: MapProps) {
      captured.props = props;
      return (
        <div data-testid="map-stub" data-selected={props.selectedSlug ?? ''} />
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

  describe('selection', () => {
    it('starts without a selected pin', () => {
      render(<ResultsList items={ITEMS} />);

      expect(captured.props?.selectedSlug).toBeNull();
    });

    it('selects the pin of the card the mouse is over', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.hover(screen.getByRole('link', { name: 'Arena 2' }));

      expect(screen.getByTestId('map-stub')).toHaveAttribute(
        'data-selected',
        'arena-2',
      );
    });

    it('selects the pin of the card that gets keyboard focus', async () => {
      render(<ResultsList items={ITEMS} />);

      await userEvent.tab();
      expect(captured.props?.selectedSlug).toBe('arena-1');
      await userEvent.tab();
      expect(captured.props?.selectedSlug).toBe('arena-2');
    });

    it('follows a pin selected on the map', () => {
      render(<ResultsList items={ITEMS} />);

      act(() => {
        captured.props?.onSelect('arena-3');
      });

      expect(captured.props?.selectedSlug).toBe('arena-3');
      act(() => {
        captured.props?.onSelect(null);
      });
      expect(captured.props?.selectedSlug).toBeNull();
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
