import { ZoomControl } from 'react-leaflet';

/**
 * Leaflet's zoom buttons with Portuguese names (Leaflet's own are in English
 * and are also what a screen reader announces). Render it inside a
 * `MapContainer` that has `zoomControl={false}`.
 */
export function MapZoomControl() {
  return <ZoomControl zoomInTitle="Aproximar" zoomOutTitle="Afastar" />;
}
