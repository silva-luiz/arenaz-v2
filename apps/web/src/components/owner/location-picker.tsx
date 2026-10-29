'use client';

import { Field, Input } from '@arenaz/ui';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Leaflet touches `window` on import, so the map is client-only.
const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="h-64 w-full animate-pulse rounded-photo bg-surface motion-reduce:animate-none"
    />
  ),
});

export interface LatLngValue {
  lat: number;
  lng: number;
}

export interface LocationPickerProps {
  /** `null` while the location is not set (or only half typed). */
  value: LatLngValue | null;
  onChange: (value: LatLngValue | null) => void;
  errors?: { lat?: string | undefined; lng?: string | undefined } | undefined;
}

/** "-23,5" and "-23.5" are both fine; blank or garbage is `null`. */
function parseCoordinate(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTexts(value: LatLngValue | null): { lat: string; lng: string } {
  return {
    lat: value ? String(value.lat) : '',
    lng: value ? String(value.lng) : '',
  };
}

/**
 * Pin on a map plus numeric latitude/longitude fields. The fields are the
 * accessible way to set the location (the map needs a pointer); both stay in
 * sync with `value`.
 */
export function LocationPicker({
  value,
  onChange,
  errors,
}: LocationPickerProps) {
  // The inputs keep their own text so "-2" or "-23," survive while typing.
  const [texts, setTexts] = useState(() => toTexts(value));
  const [seen, setSeen] = useState(value);

  // Adopt a value that changed from outside (CEP lookup, map drag) unless the
  // fields already say the same thing. Done while rendering, as React advises
  // for state derived from props.
  if (value?.lat !== seen?.lat || value?.lng !== seen?.lng) {
    setSeen(value);
    if (
      value &&
      (parseCoordinate(texts.lat) !== value.lat ||
        parseCoordinate(texts.lng) !== value.lng)
    ) {
      setTexts(toTexts(value));
    }
  }

  function edit(next: { lat: string; lng: string }) {
    setTexts(next);
    const lat = parseCoordinate(next.lat);
    const lng = parseCoordinate(next.lng);
    onChange(lat !== null && lng !== null ? { lat, lng } : null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" error={errors?.lat}>
          <Input
            type="text"
            inputMode="decimal"
            value={texts.lat}
            onChange={(event) => {
              edit({ ...texts, lat: event.target.value });
            }}
          />
        </Field>
        <Field label="Longitude" error={errors?.lng}>
          <Input
            type="text"
            inputMode="decimal"
            value={texts.lng}
            onChange={(event) => {
              edit({ ...texts, lng: event.target.value });
            }}
          />
        </Field>
      </div>
      <div
        role="group"
        aria-label="Mapa para marcar o local. A alternativa acessível são os campos acima"
        className="isolate overflow-hidden rounded-photo border border-line"
      >
        <LocationMap
          value={value}
          onChange={(next) => {
            edit(toTexts(next));
          }}
        />
      </div>
      <p className="text-sm text-muted">
        Clique no mapa ou arraste o pino para ajustar. Também dá para digitar as
        coordenadas.
      </p>
    </div>
  );
}
