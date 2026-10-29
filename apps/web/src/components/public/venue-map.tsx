'use client';

import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, TileLayer } from 'react-leaflet';
import { MapZoomControl } from '@/components/ui/map-zoom-control';

/** The public location is rounded to 2 decimals: about 1 km of uncertainty. */
const AREA_RADIUS_M = 1000;
// At this zoom a 1 km radius is about 115px on the screen: the whole circle
// fits in the 288px-high map with room around it.
const ZOOM = 14;

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const BRAND_FALLBACK = '#0b7a4b';

/** The `--color-brand` token, read once the browser is there (no SSR here). */
function brandColor(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-brand')
    .trim();
  return value === '' ? BRAND_FALLBACK : value;
}

export interface VenueMapProps {
  lat: number;
  lng: number;
}

/**
 * The map of "Onde fica": the APPROXIMATE area of a venue, a circle of about
 * 1 km and no pin (the exact address only shows after booking). It is a
 * static view: it cannot be dragged, nor zoomed by wheel, double click or
 * pinch (so it never traps the page scroll on a phone); the zoom buttons
 * remain. Loaded only in the browser, see `venue-location.tsx`.
 *
 * `isolate` gives the Leaflet panes (z-index up to 700) their own stacking
 * context, so they stay under the sticky header and the booking bar.
 */
export default function VenueMap({ lat, lng }: VenueMapProps) {
  const color = brandColor();
  return (
    <div
      role="region"
      aria-label="Mapa da região do espaço"
      className="relative isolate h-72 overflow-hidden rounded-photo bg-surface"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={ZOOM}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        className="size-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
        />
        <MapZoomControl />
        <Circle
          center={[lat, lng]}
          radius={AREA_RADIUS_M}
          pathOptions={{
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
          }}
        />
      </MapContainer>
    </div>
  );
}
