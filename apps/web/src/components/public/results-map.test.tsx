import type { PublicVenueCard } from '@arenaz/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  size: { x: 800, y: 600 },
  pane: { setAttribute: vi.fn() },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    zoomControl,
  }: {
    children: ReactNode;
    zoomControl?: boolean;
  }) => (
    <div data-testid="map-container" data-zoom-control={String(zoomControl)}>
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="tiles" data-url={url} data-attribution={attribution} />
  ),
  ZoomControl: ({
    zoomInTitle,
    zoomOutTitle,
  }: {
    zoomInTitle: string;
    zoomOutTitle: string;
  }) => (
    <div
      data-testid="zoom-control"
      data-in={zoomInTitle}
      data-out={zoomOutTitle}
    />
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
    getSize: () => captured.size,
    getContainer: () => document.createElement('div'),
    getPane: () => captured.pane,
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
    nextFreeTime: null,
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
  const onPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    captured.markers = [];
    captured.events = null;
    captured.size = { x: 800, y: 600 };
  });

  it('is a labelled region', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Mapa dos resultados' }),
    ).toBeInTheDocument();
  });

  it('has zoom buttons named in Portuguese', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-zoom-control',
      'false',
    );
    const zoom = screen.getByTestId('zoom-control');
    expect(zoom).toHaveAttribute('data-in', 'Aproximar');
    expect(zoom).toHaveAttribute('data-out', 'Afastar');
  });

  it('uses OpenStreetMap tiles with attribution', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
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
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(captured.markers.map((marker) => marker.position)).toEqual([
      [-23.55, -46.69],
      [-23.56, -46.7],
    ]);
    expect(html(captured.markers[0])).toContain('R$ 180');
    expect(html(captured.markers[1])).toContain('R$ 120,50');
  });

  it('highlights the hovered pin, and only that one', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug="arena-b"
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(html(captured.markers[0])).not.toContain('bg-ink');
    expect(html(captured.markers[1])).toContain('bg-ink');
    expect(html(captured.markers[1])).toContain('text-white');
  });

  it('a hovered pin opens no preview', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug="arena-b"
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Fechar prévia' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the previewed pin highlighted', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug="arena-a"
        onPreview={onPreview}
      />,
    );

    expect(html(captured.markers[0])).toContain('bg-ink');
  });

  it('hides the pins from assistive technology: the list is the accessible equivalent', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(captured.pane.setAttribute).toHaveBeenCalledWith(
      'aria-hidden',
      'true',
    );
  });

  it('keeps the pins out of the tab order: the list is the keyboard path', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(captured.markers.every((marker) => marker.keyboard === false)).toBe(
      true,
    );
  });

  it('opens the preview of a result when its pin is clicked', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    captured.markers[1]?.eventHandlers.click();

    expect(onPreview).toHaveBeenCalledWith('arena-b');
  });

  it('clears the selection when the map itself is clicked', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug="arena-a"
        onPreview={onPreview}
      />,
    );

    captured.events?.click();

    expect(onPreview).toHaveBeenCalledWith(null);
  });

  it('fits the map to the results', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
      />,
    );

    expect(captured.fitBounds).toHaveBeenCalledTimes(1);
    const bounds = captured.fitBounds.mock.calls[0]?.[0] as {
      getSouthWest: () => { lat: number; lng: number };
      getNorthEast: () => { lat: number; lng: number };
    };
    expect(bounds.getSouthWest()).toMatchObject({ lat: -23.56, lng: -46.7 });
    expect(bounds.getNorthEast()).toMatchObject({ lat: -23.55, lng: -46.69 });
  });

  describe('revealing the clicked pin', () => {
    it('pans a clicked pin clear of the preview that will cover the bottom', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      act(() => {
        captured.markers.at(-1)?.eventHandlers.click();
      });

      expect(captured.panInside).toHaveBeenCalledTimes(1);
      expect(captured.panInside.mock.calls[0]?.[0]).toEqual([-23.56, -46.7]);
    });

    it('pans again when the same pin is clicked again', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      act(() => {
        captured.markers[0]?.eventHandlers.click();
      });
      act(() => {
        captured.markers[0]?.eventHandlers.click();
      });

      expect(captured.panInside).toHaveBeenCalledTimes(2);
    });

    it('leaves the map alone when a card is hovered, so it does not jump around', () => {
      const { rerender } = render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      rerender(
        <ResultsMap
          items={ITEMS}
          hoveredSlug="arena-b"
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      expect(captured.panInside).not.toHaveBeenCalled();
    });
  });

  describe('fitting', () => {
    const observers: { callback: () => void; disconnect: () => void }[] = [];

    beforeEach(() => {
      observers.length = 0;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          disconnect: () => void;
          constructor(callback: () => void) {
            const entry = { callback, disconnect: vi.fn() };
            observers.push(entry);
            this.disconnect = entry.disconnect;
          }
          observe() {
            // the container is a stub
          }
        },
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('waits for a real size before fitting (the map starts hidden on a phone)', () => {
      captured.size = { x: 0, y: 0 };
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      expect(captured.fitBounds).not.toHaveBeenCalled();

      captured.size = { x: 375, y: 600 };
      act(() => {
        observers.at(-1)?.callback();
      });

      expect(captured.fitBounds).toHaveBeenCalledTimes(1);
    });

    it('only re-measures on later size changes, without refitting', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );
      captured.invalidateSize.mockClear();

      act(() => {
        observers.at(-1)?.callback();
      });

      expect(captured.invalidateSize).toHaveBeenCalled();
      expect(captured.fitBounds).toHaveBeenCalledTimes(1);
    });

    it('fits again when the results change (next page)', () => {
      const { rerender } = render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      rerender(
        <ResultsMap
          items={[venue('arena-c', 'Arena C', 9000, -23.6, -46.6)]}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      expect(captured.fitBounds).toHaveBeenCalledTimes(2);
      expect(observers[0]?.disconnect).toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('is not shown without a selection', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      expect(
        screen.queryByRole('link', { name: /Arena/ }),
      ).not.toBeInTheDocument();
    });

    it('shows the selected venue with a link to its page', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-b"
          onPreview={onPreview}
        />,
      );

      const link = screen.getByRole('link', { name: /Arena B/ });
      expect(link).toHaveAttribute('href', '/espacos/arena-b');
      expect(within(link).getByText(/R\$\s120,50/)).toBeInTheDocument();
      expect(within(link).getByText(/Vila Madalena, São Paulo/)).toBeVisible();
    });

    it('can be closed', async () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-a"
          onPreview={onPreview}
        />,
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'Fechar prévia' }),
      );

      expect(onPreview).toHaveBeenCalledWith(null);
    });

    it('closes with Esc', async () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-a"
          onPreview={onPreview}
        />,
      );

      await userEvent.keyboard('{Escape}');

      expect(onPreview).toHaveBeenCalledWith(null);
    });

    it('ignores an Esc that something else already handled', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-a"
          onPreview={onPreview}
        />,
      );

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      document.dispatchEvent(event);

      expect(onPreview).not.toHaveBeenCalled();
    });

    it('does not listen for Esc while no preview is open', async () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
        />,
      );

      await userEvent.keyboard('{Escape}');

      expect(onPreview).not.toHaveBeenCalled();
    });

    it('ignores a preview slug that is not among the results', () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="outra"
          onPreview={onPreview}
        />,
      );

      expect(
        screen.queryByRole('button', { name: 'Fechar prévia' }),
      ).not.toBeInTheDocument();
    });
  });
});
