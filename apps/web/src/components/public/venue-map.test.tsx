import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MapProps {
  center: [number, number];
  zoom: number;
  dragging?: boolean;
  scrollWheelZoom?: boolean;
  doubleClickZoom?: boolean;
  zoomControl?: boolean;
}
interface CircleProps {
  center: [number, number];
  radius: number;
}

const captured = vi.hoisted(() => ({
  map: null as MapProps | null,
  circles: [] as CircleProps[],
  markers: 0,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    ...props
  }: MapProps & { children: ReactNode }) => {
    captured.map = props;
    return <div data-testid="map-container">{children}</div>;
  },
  TileLayer: ({ attribution }: { attribution: string }) => (
    <div data-testid="tiles" data-attribution={attribution} />
  ),
  Circle: (props: CircleProps) => {
    captured.circles.push(props);
    return <div data-testid="circle" />;
  },
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
  Marker: () => {
    captured.markers += 1;
    return <div data-testid="marker" />;
  },
}));

import VenueMap from './venue-map';

describe('VenueMap', () => {
  beforeEach(() => {
    captured.map = null;
    captured.circles = [];
    captured.markers = 0;
  });

  it('is centred on the approximate location', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    expect(captured.map?.center).toEqual([-23.55, -46.69]);
  });

  it('draws a circle of about 1 km and no pin', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    expect(captured.circles).toHaveLength(1);
    expect(captured.circles[0]).toMatchObject({
      center: [-23.55, -46.69],
      radius: 1000,
    });
    expect(captured.markers).toBe(0);
  });

  it('has zoom buttons named in Portuguese', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    expect(captured.map?.zoomControl).toBe(false);
    const zoom = screen.getByTestId('zoom-control');
    expect(zoom).toHaveAttribute('data-in', 'Aproximar');
    expect(zoom).toHaveAttribute('data-out', 'Afastar');
  });

  it('cannot be dragged or zoomed by accident', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    expect(captured.map).toMatchObject({
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });
  });

  it('is a labelled region that keeps its panes under the sticky header', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    const region = screen.getByRole('region', {
      name: 'Mapa da região do espaço',
    });
    expect(region).toHaveClass('isolate');
  });

  it('credits OpenStreetMap', () => {
    render(<VenueMap lat={-23.55} lng={-46.69} />);

    expect(
      screen.getByTestId('tiles').getAttribute('data-attribution'),
    ).toContain('OpenStreetMap');
  });
});
