import type { ControlPosition } from 'leaflet';
import { ZoomControl } from 'react-leaflet';

/**
 * Leaflet's zoom buttons with Portuguese names (Leaflet's own are in English
 * and are also what a screen reader announces). Render it inside a
 * `MapContainer` that has `zoomControl={false}`. Look and 44px size: see
 * `globals.css`.
 */
export function MapZoomControl({
  position = 'topleft',
}: {
  position?: ControlPosition;
}) {
  return (
    <ZoomControl
      position={position}
      zoomInTitle="Aproximar"
      zoomOutTitle="Afastar"
    />
  );
}
