'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` on import, so the map is client-only.
const VenueMap = dynamic(() => import('./venue-map'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="h-72 animate-pulse rounded-photo bg-surface motion-reduce:animate-none"
    />
  ),
});

/** Client boundary that lets the server-rendered page load the map lazily. */
export function VenueLocation({ lat, lng }: { lat: number; lng: number }) {
  return <VenueMap lat={lat} lng={lng} />;
}
