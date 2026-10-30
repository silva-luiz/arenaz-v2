'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { MapZoomControl } from '@/components/ui/map-zoom-control';
import type { LatLngValue } from './location-picker';

/** Brazil, for when there is no location yet. */
const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];
const BRAZIL_ZOOM = 4;
const PIN_ZOOM = 16;

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Leaflet's default marker is a PNG that bundlers cannot resolve, so the pin
// is a styled div instead (brand color, no external asset). The tip of the
// rotated drop sits 34px below the top of the 28px box.
const PIN_ICON = L.divIcon({
  className: '',
  html: '<span class="block size-7 -rotate-45 rounded-[50%_50%_50%_0] border-2 border-white bg-brand shadow-2"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 34],
});

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Click on the map places the pin. */
function ClickToPlace({
  onChange,
}: {
  onChange: (value: LatLngValue) => void;
}) {
  useMapEvents({
    click(event) {
      onChange({
        lat: round6(event.latlng.lat),
        lng: round6(event.latlng.lng),
      });
    },
  });
  return null;
}

/**
 * Brings a new pin into view: zooms to it when it appears (for example after a
 * CEP lookup, while the map still shows the whole country) and pans when it
 * is moved out of view. A pin dragged inside the view leaves the view alone.
 */
function FollowValue({ value }: { value: LatLngValue | null }) {
  const map = useMap();
  const hadValue = useRef(false);
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      hadValue.current = false;
      return;
    }
    const appeared = !hadValue.current;
    hadValue.current = true;
    if (appeared) {
      map.setView([lat, lng], PIN_ZOOM);
    } else if (!map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), PIN_ZOOM));
    }
  }, [map, lat, lng]);
  return null;
}

export interface LocationMapProps {
  value: LatLngValue | null;
  onChange: (value: LatLngValue) => void;
}

/** The Leaflet map. Loaded only in the browser, see `location-picker.tsx`. */
export default function LocationMap({ value, onChange }: LocationMapProps) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : BRAZIL_CENTER}
      zoom={value ? PIN_ZOOM : BRAZIL_ZOOM}
      scrollWheelZoom={false}
      zoomControl={false}
      // A one-finger drag would otherwise trap the page scroll on phones; the
      // pin itself stays draggable and a tap still places it.
      dragging={!L.Browser.mobile}
      className="h-64 w-full"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={OSM_ATTRIBUTION}
        maxZoom={19}
      />
      <MapZoomControl />
      <ClickToPlace onChange={onChange} />
      <FollowValue value={value} />
      {value ? (
        <Marker
          position={[value.lat, value.lng]}
          icon={PIN_ICON}
          draggable
          // Not focusable: the pin cannot be moved with the keyboard, the
          // numeric fields are the keyboard path.
          keyboard={false}
          eventHandlers={{
            dragend(event) {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onChange({ lat: round6(lat), lng: round6(lng) });
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
