import { render, screen } from '@testing-library/react';
import type { LeafletMouseEvent } from 'leaflet';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MarkerProps {
  position: [number, number];
  draggable?: boolean;
  keyboard?: boolean;
  icon?: { options: { html?: string | HTMLElement } };
  eventHandlers: {
    dragend: (event: {
      target: { getLatLng: () => { lat: number; lng: number } };
    }) => void;
  };
}

const captured = vi.hoisted(() => ({
  marker: null as MarkerProps | null,
  events: null as {
    click: (event: Pick<LeafletMouseEvent, 'latlng'>) => void;
  } | null,
  setView: vi.fn(),
  inView: false,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="tiles" data-url={url} data-attribution={attribution} />
  ),
  Marker: (props: MarkerProps) => {
    captured.marker = props;
    return <div data-testid="marker" />;
  },
  useMap: () => ({
    setView: captured.setView,
    getZoom: () => 16,
    // The view only moves when the new position is outside of it.
    getBounds: () => ({ contains: () => captured.inView }),
  }),
  useMapEvents: (handlers: NonNullable<typeof captured.events>) => {
    captured.events = handlers;
    return null;
  },
}));

import LocationMap from './location-map';

describe('LocationMap', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    captured.marker = null;
    captured.events = null;
    captured.inView = false;
  });

  it('uses OpenStreetMap tiles with attribution', () => {
    render(<LocationMap value={null} onChange={onChange} />);

    const tiles = screen.getByTestId('tiles');
    expect(tiles).toHaveAttribute(
      'data-url',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(tiles.getAttribute('data-attribution')).toContain(
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    );
  });

  it('shows no pin until there is a location', () => {
    render(<LocationMap value={null} onChange={onChange} />);

    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });

  it('shows a draggable pin drawn with a styled div, not an image file', () => {
    render(
      <LocationMap value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );

    expect(captured.marker).toMatchObject({
      position: [-23.5, -46.6],
      draggable: true,
      keyboard: false,
    });
    const html = captured.marker?.icon?.options.html;
    expect(typeof html).toBe('string');
    expect(html).not.toContain('<img');
  });

  it('reports the dropped position rounded to 6 decimals', () => {
    render(
      <LocationMap value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );

    captured.marker?.eventHandlers.dragend({
      target: { getLatLng: () => ({ lat: -23.55123456789, lng: -46.6 }) },
    });

    expect(onChange).toHaveBeenCalledWith({ lat: -23.551235, lng: -46.6 });
  });

  it('places the pin where the map is clicked', () => {
    render(<LocationMap value={null} onChange={onChange} />);

    captured.events?.click({
      latlng: { lat: -22.9, lng: -43.2 },
    } as Pick<LeafletMouseEvent, 'latlng'>);

    expect(onChange).toHaveBeenCalledWith({ lat: -22.9, lng: -43.2 });
  });

  it('zooms to the pin when it first appears, even if it is already in view', () => {
    captured.inView = true;
    const { rerender } = render(
      <LocationMap value={null} onChange={onChange} />,
    );
    expect(captured.setView).not.toHaveBeenCalled();

    rerender(
      <LocationMap value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );

    expect(captured.setView).toHaveBeenCalledWith([-23.5, -46.6], 16);
  });

  it('leaves the view alone when the pin moves inside it', () => {
    captured.inView = true;
    const { rerender } = render(
      <LocationMap value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );
    captured.setView.mockClear();

    rerender(
      <LocationMap
        value={{ lat: -23.501, lng: -46.601 }}
        onChange={onChange}
      />,
    );

    expect(captured.setView).not.toHaveBeenCalled();
  });

  it('pans to the pin when it moves out of view', () => {
    const { rerender } = render(
      <LocationMap value={{ lat: -23.5, lng: -46.6 }} onChange={onChange} />,
    );
    captured.setView.mockClear();

    rerender(
      <LocationMap value={{ lat: -22.9, lng: -43.2 }} onChange={onChange} />,
    );

    expect(captured.setView).toHaveBeenCalledWith([-22.9, -43.2], 16);
  });
});
