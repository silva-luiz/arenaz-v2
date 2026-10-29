import type { PublicVenueCard } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MarkerProps {
  position: [number, number];
  keyboard?: boolean;
  title?: string;
  zIndexOffset?: number;
  icon: { options: { html?: string | HTMLElement } };
  eventHandlers: { click: () => void };
}

const captured = vi.hoisted(() => ({
  markers: [] as MarkerProps[],
  events: null as { click: () => void } | null,
  fitBounds: vi.fn(),
  panInside: vi.fn(),
  invalidateSize: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="tiles" data-url={url} data-attribution={attribution} />
  ),
  Marker: (props: MarkerProps) => {
    captured.markers.push(props);
    return <div data-testid="marker" />;
  },
  useMap: () => ({
    fitBounds: captured.fitBounds,
    panInside: captured.panInside,
    setView: vi.fn(),
    invalidateSize: captured.invalidateSize,
    getSize: () => ({ x: 800, y: 600 }),
    getContainer: () => document.createElement('div'),
  }),
  useMapEvents: (handlers: { click: () => void }) => {
    captured.events = handlers;
    return null;
  },
}));

import ResultsMap from './results-map';

function venue(
  slug: string,
  name: string,
  cents: number,
  lat: number,
  lng: number,
): PublicVenueCard {
  return {
    slug,
    name,
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: null,
    sports: ['futsal'],
    minPriceCentsPerHour: cents,
    approxLocation: { lat, lng },
    distanceKm: null,
  };
}

const ITEMS = [
  venue('arena-a', 'Arena A', 18000, -23.55, -46.69),
  venue('arena-b', 'Arena B', 12050, -23.56, -46.7),
];

function html(marker: MarkerProps | undefined): string {
  const value = marker?.icon.options.html;
  return typeof value === 'string' ? value : '';
}

describe('ResultsMap', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    captured.markers = [];
    captured.events = null;
  });

  it('is a labelled region', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    expect(
      screen.getByRole('region', { name: 'Mapa dos resultados' }),
    ).toBeInTheDocument();
  });

  it('uses OpenStreetMap tiles with attribution', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    const tiles = screen.getByTestId('tiles');
    expect(tiles).toHaveAttribute(
      'data-url',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(tiles.getAttribute('data-attribution')).toContain('OpenStreetMap');
  });

  it('draws one price pin per result at its approximate location', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    expect(captured.markers.map((marker) => marker.position)).toEqual([
      [-23.55, -46.69],
      [-23.56, -46.7],
    ]);
    expect(html(captured.markers[0])).toContain('R$ 180');
    expect(html(captured.markers[1])).toContain('R$ 120,50');
  });

  it('highlights only the selected pin', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug="arena-b" onSelect={onSelect} />,
    );

    expect(html(captured.markers[0])).not.toContain('bg-ink');
    expect(html(captured.markers[1])).toContain('bg-ink');
    expect(html(captured.markers[1])).toContain('text-white');
  });

  it('keeps the pins out of the tab order: the list is the keyboard path', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    expect(captured.markers.every((marker) => marker.keyboard === false)).toBe(
      true,
    );
  });

  it('selects a result when its pin is clicked', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    captured.markers[1]?.eventHandlers.click();

    expect(onSelect).toHaveBeenCalledWith('arena-b');
  });

  it('clears the selection when the map itself is clicked', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug="arena-a" onSelect={onSelect} />,
    );

    captured.events?.click();

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('fits the map to the results', () => {
    render(
      <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
    );

    expect(captured.fitBounds).toHaveBeenCalledTimes(1);
    const bounds = captured.fitBounds.mock.calls[0]?.[0] as {
      getSouthWest: () => { lat: number; lng: number };
      getNorthEast: () => { lat: number; lng: number };
    };
    expect(bounds.getSouthWest()).toMatchObject({ lat: -23.56, lng: -46.7 });
    expect(bounds.getNorthEast()).toMatchObject({ lat: -23.55, lng: -46.69 });
  });

  describe('revealing the selected pin', () => {
    it('pans a clicked pin clear of the preview that will cover the bottom', () => {
      const { rerender } = render(
        <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
      );

      captured.markers.at(-1)?.eventHandlers.click();
      rerender(
        <ResultsMap items={ITEMS} selectedSlug="arena-b" onSelect={onSelect} />,
      );

      expect(captured.panInside).toHaveBeenCalledTimes(1);
      expect(captured.panInside.mock.calls[0]?.[0]).toEqual([-23.56, -46.7]);
    });

    it('leaves the map alone when a card is hovered, so it does not jump around', () => {
      const { rerender } = render(
        <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
      );

      rerender(
        <ResultsMap items={ITEMS} selectedSlug="arena-b" onSelect={onSelect} />,
      );

      expect(captured.panInside).not.toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('is not shown without a selection', () => {
      render(
        <ResultsMap items={ITEMS} selectedSlug={null} onSelect={onSelect} />,
      );

      expect(
        screen.queryByRole('link', { name: /Arena/ }),
      ).not.toBeInTheDocument();
    });

    it('shows the selected venue with a link to its page', () => {
      render(
        <ResultsMap items={ITEMS} selectedSlug="arena-b" onSelect={onSelect} />,
      );

      const link = screen.getByRole('link', { name: /Arena B/ });
      expect(link).toHaveAttribute('href', '/espacos/arena-b');
      expect(within(link).getByText(/R\$\s120,50/)).toBeInTheDocument();
      expect(within(link).getByText(/Vila Madalena, São Paulo/)).toBeVisible();
    });

    it('can be closed', async () => {
      render(
        <ResultsMap items={ITEMS} selectedSlug="arena-a" onSelect={onSelect} />,
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'Fechar prévia' }),
      );

      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('ignores a selection that is not among the results', () => {
      render(
        <ResultsMap items={ITEMS} selectedSlug="outra" onSelect={onSelect} />,
      );

      expect(
        screen.queryByRole('button', { name: 'Fechar prévia' }),
      ).not.toBeInTheDocument();
    });
  });
});
