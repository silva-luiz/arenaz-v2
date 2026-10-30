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
  eventHandlers: {
    click: () => void;
    keydown: (event: { originalEvent: KeyboardEvent }) => void;
  };
  ref?: { current: { getElement: () => HTMLElement | undefined } | null };
}

const captured = vi.hoisted(() => ({
  markers: [] as MarkerProps[],
  events: null as { click: () => void } | null,
  fitBounds: vi.fn(),
  panInside: vi.fn(),
  invalidateSize: vi.fn(),
  size: { x: 800, y: 600 },
  elements: [] as HTMLElement[],
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
    // What react-leaflet gives the ref: the Leaflet marker, whose element is
    // the (focusable) icon container.
    const element = document.createElement('div');
    captured.elements.push(element);
    if (props.ref) props.ref.current = { getElement: () => element };
    return <div data-testid="marker" />;
  },
  useMap: () => ({
    fitBounds: captured.fitBounds,
    panInside: captured.panInside,
    setView: vi.fn(),
    invalidateSize: captured.invalidateSize,
    getSize: () => captured.size,
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
    coverSrcSet: null,
    sports: ['futsal'],
    minPriceCentsPerHour: cents,
    approxLocation: { lat, lng },
    distanceKm: null,
    nextFreeTime: null,
    freeTimes: [],
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

const hrefFor = (slug: string) => `/espacos/${slug}?data=2026-10-30`;

describe('ResultsMap', () => {
  const onPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    captured.markers = [];
    captured.events = null;
    captured.elements = [];
    captured.size = { x: 800, y: 600 };
  });

  it('is a labelled region', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
      />,
    );

    expect(html(captured.markers[0])).toContain('bg-ink');
  });

  it('shows the cover variants in the preview, sized to its thumbnail', () => {
    const [first, second] = ITEMS;
    if (!first || !second) throw new Error('fixture');
    render(
      <ResultsMap
        items={[
          {
            ...first,
            coverUrl: 'http://img.test/a.jpg',
            coverSrcSet: 'http://img.test/a.w400.webp 400w',
          },
          second,
        ]}
        hoveredSlug={null}
        previewSlug="arena-a"
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    const img = document.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://img.test/a.jpg');
    expect(img).toHaveAttribute('srcset', 'http://img.test/a.w400.webp 400w');
    expect(img).toHaveAttribute('sizes', '340px');
  });

  it('puts every pin in the tab order, in the order of the list', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    expect(captured.markers).toHaveLength(2);
    expect(captured.markers.every((marker) => marker.keyboard === true)).toBe(
      true,
    );
  });

  it('names each pin with the venue and the price, as a button that is not pressed', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    expect(captured.elements[0]).toHaveAttribute(
      'aria-label',
      'Arena A, R$ 180 por hora',
    );
    expect(captured.elements[1]).toHaveAttribute(
      'aria-label',
      'Arena B, R$ 120,50 por hora',
    );
    expect(captured.elements[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the selected pin as pressed, and only that one', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug="arena-b"
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    expect(captured.elements[0]).toHaveAttribute('aria-pressed', 'false');
    expect(captured.elements[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('a hovered pin is dark but not pressed (hover is not a selection)', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug="arena-a"
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    expect(html(captured.markers[0])).toContain('bg-ink');
    expect(captured.elements[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it.each([' ', 'Enter'])('opens the preview with the %j key', (key) => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );
    const originalEvent = new KeyboardEvent('keydown', {
      key,
      cancelable: true,
    });

    captured.markers[1]?.eventHandlers.keydown({ originalEvent });

    expect(originalEvent.defaultPrevented).toBe(true);
    expect(onPreview).toHaveBeenCalledWith('arena-b');
  });

  it('ignores other keys', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
      />,
    );

    captured.markers[0]?.eventHandlers.keydown({
      originalEvent: new KeyboardEvent('keydown', { key: 'a' }),
    });

    expect(onPreview).not.toHaveBeenCalled();
  });

  it('opens the preview of a result when its pin is clicked', () => {
    render(
      <ResultsMap
        items={ITEMS}
        hoveredSlug={null}
        previewSlug={null}
        onPreview={onPreview}
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
        hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
        />,
      );

      rerender(
        <ResultsMap
          items={ITEMS}
          hoveredSlug="arena-b"
          previewSlug={null}
          onPreview={onPreview}
          hrefFor={hrefFor}
        />,
      );

      expect(captured.panInside).not.toHaveBeenCalled();
    });
  });

  describe('revealing a pin selected from its card', () => {
    it('pans the pin clear of the preview when the selection changes', () => {
      const { rerender } = render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
          hrefFor={hrefFor}
        />,
      );
      expect(captured.panInside).not.toHaveBeenCalled();

      rerender(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-b"
          onPreview={onPreview}
          hrefFor={hrefFor}
        />,
      );

      expect(captured.panInside).toHaveBeenCalledTimes(1);
      expect(captured.panInside.mock.calls[0]?.[0]).toEqual([-23.56, -46.7]);
    });

    it('does not pan when the preview closes', () => {
      const { rerender } = render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-a"
          onPreview={onPreview}
          hrefFor={hrefFor}
        />,
      );
      captured.panInside.mockClear();

      rerender(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
        />,
      );

      rerender(
        <ResultsMap
          items={[venue('arena-c', 'Arena C', 9000, -23.6, -46.6)]}
          hoveredSlug={null}
          previewSlug={null}
          onPreview={onPreview}
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
        />,
      );

      const link = screen.getByRole('link', { name: /Arena B/ });
      expect(link).toHaveAttribute('href', '/espacos/arena-b?data=2026-10-30');
      expect(within(link).getByText(/R\$\s120,50/)).toBeInTheDocument();
      expect(within(link).getByText(/Vila Madalena/)).toBeVisible();
    });

    it('can be closed', async () => {
      render(
        <ResultsMap
          items={ITEMS}
          hoveredSlug={null}
          previewSlug="arena-a"
          onPreview={onPreview}
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
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
          hrefFor={hrefFor}
        />,
      );

      expect(
        screen.queryByRole('button', { name: 'Fechar prévia' }),
      ).not.toBeInTheDocument();
    });
  });
});
