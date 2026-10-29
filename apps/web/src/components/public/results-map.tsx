'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { MapZoomControl } from '@/components/ui/map-zoom-control';
import { MapPreview } from './map-preview';
import { pinLabel, priceIcon } from './map-pin';

/** São Paulo, only until the results are fitted (there is always one). */
const FALLBACK_CENTER: [number, number] = [-23.55, -46.64];
const FALLBACK_ZOOM = 11;
const FIT_PADDING: [number, number] = [56, 56];
// A single venue (or a few in the same block) must not zoom to rooftops: the
// public location is rounded to about 1 km anyway.
const FIT_MAX_ZOOM = 14;

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Fits the view to the results. The map may start inside a `display: none`
 * container (the mobile list view), where Leaflet measures 0x0 and a fit would
 * be meaningless; so the fit waits for the first real size, and later size
 * changes (rotating the phone, switching views) re-measure the map.
 */
function FitResults({ points }: { points: L.LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    let fitted = false;
    const animate = !prefersReducedMotion();

    function fit() {
      map.invalidateSize();
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      map.fitBounds(L.latLngBounds(points), {
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        animate,
      });
      fitted = true;
    }

    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (fitted) map.invalidateSize();
      else fit();
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
    };
  }, [map, points]);

  return null;
}

// Room the preview card needs at the bottom, so a pin never ends up hidden
// behind its own preview: the card is about 270px tall (120px photo on a
// phone, 180px from `lg`) and sits 80px above the map's bottom on a phone (over
// the view switch) and 28px from `lg`; the pin needs a gap on top of that.
const PREVIEW_CLEARANCE_PHONE = 300;
const PREVIEW_CLEARANCE_DESKTOP = 340;

function previewClearance(): number {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 1024px)').matches
    ? PREVIEW_CLEARANCE_DESKTOP
    : PREVIEW_CLEARANCE_PHONE;
}

/** Asks the map to bring a point into view, clear of the preview. */
interface RevealRequest {
  point: L.LatLngTuple;
}

/**
 * Moves a pin that was just clicked out from under the preview. Every click
 * makes a new request object, so clicking the same pin again works too. Only
 * clicks ask: hovering cards highlights pins as well, and the map must not
 * jump while the mouse crosses the list.
 */
function RevealClicked({ request }: { request: RevealRequest | null }) {
  const map = useMap();

  useEffect(() => {
    if (request === null) return;
    map.panInside(request.point, {
      paddingTopLeft: [56, 56],
      paddingBottomRight: [56, previewClearance()],
      animate: !prefersReducedMotion(),
    });
  }, [map, request]);

  return null;
}

/**
 * Brings the selected pin into view when the selection changes, whoever made
 * it (a click on the pin is handled by `RevealClicked`; this covers the "show
 * on the map" button of a card). Closing the preview does not move the map.
 */
function RevealSelected({ point }: { point: L.LatLngTuple | null }) {
  const map = useMap();
  const lat = point?.[0];
  const lng = point?.[1];

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.panInside([lat, lng], {
      paddingTopLeft: [56, 56],
      paddingBottomRight: [56, previewClearance()],
      animate: !prefersReducedMotion(),
    });
  }, [map, lat, lng]);

  return null;
}

/** Esc closes the preview, wherever the focus is. */
function CloseOnEscape({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
  return null;
}

/** A click on the bare map closes the preview. */
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

interface PricePinProps {
  venue: PublicVenueCard;
  /** Dark pin: hovered card or selected venue. */
  highlighted: boolean;
  /** The selected venue (`aria-pressed`). */
  selected: boolean;
  onSelect: (venue: PublicVenueCard) => void;
}

/**
 * One price pin. Leaflet makes the marker's icon element a focusable
 * `role="button"` (`keyboard`); this gives that element its name ("Arena Vila
 * Madalena, R$ 180 por hora", the label only shows the price) and its pressed
 * state. The element is kept when the icon changes (a divIcon reuses its
 * container), so focus survives selecting the pin.
 */
function PricePin({ venue, highlighted, selected, onSelect }: PricePinProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const label = pinLabel(venue.name, venue.minPriceCentsPerHour);

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-pressed', String(selected));
  }, [label, selected]);

  return (
    <Marker
      ref={markerRef}
      position={[venue.approxLocation.lat, venue.approxLocation.lng]}
      icon={priceIcon(venue.minPriceCentsPerHour, highlighted)}
      keyboard
      zIndexOffset={highlighted ? 1000 : 0}
      eventHandlers={{
        click: () => {
          onSelect(venue);
        },
        // Leaflet turns no key into a click (only for popups), so the two
        // keys of a button are handled here.
        keydown: (event) => {
          if (
            event.originalEvent.key !== 'Enter' &&
            event.originalEvent.key !== ' '
          )
            return;
          event.originalEvent.preventDefault();
          onSelect(venue);
        },
      }}
    />
  );
}

export interface ResultsMapProps {
  items: PublicVenueCard[];
  /** Pin highlighted because its card is hovered or focused. No preview. */
  hoveredSlug: string | null;
  /** The selected venue: dark pin, open preview. Set from a pin or from a card. */
  previewSlug: string | null;
  onPreview: (slug: string | null) => void;
  /** Venue page of a result, with the date and players of the search. */
  hrefFor: (slug: string) => string;
}

/**
 * The Leaflet map of the search results, one price pin per venue. Loaded only
 * in the browser, see `results-list.tsx`.
 *
 * Accessibility: the labelled region is the map's accessible name (Leaflet's
 * own container, which takes focus for arrow-key panning, adds no second
 * label), and its controls (zoom, attribution) stay as they are. Every pin is
 * a button in the tab order, in the order of the list, named with the venue
 * and the price; Enter or Space selects it (dark pin + preview), Esc closes
 * the preview.
 */
export default function ResultsMap({
  items,
  hoveredSlug,
  previewSlug,
  onPreview,
  hrefFor,
}: ResultsMapProps) {
  const points = useMemo<L.LatLngTuple[]>(
    () =>
      items.map((item) => [item.approxLocation.lat, item.approxLocation.lng]),
    [items],
  );
  const previewed = items.find((item) => item.slug === previewSlug) ?? null;
  const [revealRequest, setRevealRequest] = useState<RevealRequest | null>(
    null,
  );

  return (
    <div
      role="region"
      aria-label="Mapa dos resultados"
      className="relative isolate size-full overflow-hidden rounded-card bg-surface"
    >
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
        zoomAnimation={!prefersReducedMotion()}
        zoomControl={false}
        className="size-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
        />
        <MapZoomControl position="topright" />
        <FitResults points={points} />
        <RevealClicked request={revealRequest} />
        <RevealSelected
          point={
            previewed
              ? [previewed.approxLocation.lat, previewed.approxLocation.lng]
              : null
          }
        />
        <ClearOnMapClick
          onClear={() => {
            onPreview(null);
          }}
        />
        {items.map((item) => (
          <PricePin
            key={item.slug}
            venue={item}
            highlighted={item.slug === previewSlug || item.slug === hoveredSlug}
            selected={item.slug === previewSlug}
            onSelect={(venue) => {
              setRevealRequest({
                point: [venue.approxLocation.lat, venue.approxLocation.lng],
              });
              onPreview(venue.slug);
            }}
          />
        ))}
      </MapContainer>
      {previewed ? (
        <>
          <CloseOnEscape
            onClose={() => {
              onPreview(null);
            }}
          />
          <MapPreview
            venue={previewed}
            href={hrefFor(previewed.slug)}
            onClose={() => {
              onPreview(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
