'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { LogoMark, PriceTag } from '@arenaz/ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { MapZoomControl } from '@/components/ui/map-zoom-control';
import { AppLink } from '@/components/ui/next-link';
import { priceIcon } from './map-pin';

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
// behind its own preview: on a phone the card sits above the view switch
// (80px + about 90px of card + the pin and a gap), from `lg` up it is lower.
const PREVIEW_CLEARANCE_PHONE = 240;
const PREVIEW_CLEARANCE_DESKTOP = 140;

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
 * The pins are not an accessible path (the list is), so assistive technology
 * skips the marker pane instead of reading unnamed boxes.
 */
function HidePinsFromAssistiveTech() {
  const map = useMap();

  useEffect(() => {
    map.getPane('markerPane')?.setAttribute('aria-hidden', 'true');
  }, [map]);

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

function Preview({
  venue,
  onClose,
}: {
  venue: PublicVenueCard;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-4 bottom-20 z-[1000] mx-auto flex max-w-sm lg:bottom-6">
      <AppLink
        href={`/espacos/${venue.slug}`}
        className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-photo bg-bg shadow-3 transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="relative block w-28 shrink-0 bg-surface">
          {venue.coverUrl ? (
            // Photos come from the storage host, not a configured Next image
            // domain (same as VenueCard in @arenaz/ui).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venue.coverUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center">
              <LogoMark size={40} />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col justify-center gap-0.5 py-3 pr-12 pl-4 text-sm">
          <strong className="truncate font-semibold text-ink">
            {venue.name}
          </strong>
          <span className="truncate text-muted">
            {venue.neighborhood}, {venue.city}
          </span>
          <PriceTag cents={venue.minPriceCentsPerHour} from />
        </span>
      </AppLink>
      <button
        type="button"
        aria-label="Fechar prévia"
        onClick={onClose}
        className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-bg text-ink shadow-1 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>
    </div>
  );
}

export interface ResultsMapProps {
  items: PublicVenueCard[];
  /** Pin highlighted because its card is hovered or focused. No preview. */
  hoveredSlug: string | null;
  /** Pin whose preview is open: only set by clicking the pin. */
  previewSlug: string | null;
  onPreview: (slug: string | null) => void;
}

/**
 * The Leaflet map of the search results, one price pin per venue. Loaded only
 * in the browser, see `results-list.tsx`.
 *
 * Accessibility: the labelled region is the map's accessible name (Leaflet's
 * own container, which takes focus for arrow-key panning, adds no second
 * label), and its controls (zoom, attribution) stay as they are. The pins are
 * deliberately NOT focusable and are hidden from assistive technology
 * (`aria-hidden` on the marker pane): the list next to the map has the same
 * venues, in the same order, as real links, so it is the accessible
 * equivalent and 20 extra tab stops on the map would only be noise.
 */
export default function ResultsMap({
  items,
  hoveredSlug,
  previewSlug,
  onPreview,
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
        <MapZoomControl />
        <FitResults points={points} />
        <HidePinsFromAssistiveTech />
        <RevealClicked request={revealRequest} />
        <ClearOnMapClick
          onClear={() => {
            onPreview(null);
          }}
        />
        {items.map((item) => {
          const isSelected =
            item.slug === previewSlug || item.slug === hoveredSlug;
          return (
            <Marker
              key={item.slug}
              position={[item.approxLocation.lat, item.approxLocation.lng]}
              icon={priceIcon(item.minPriceCentsPerHour, isSelected)}
              keyboard={false}
              title={item.name}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => {
                  setRevealRequest({
                    point: [item.approxLocation.lat, item.approxLocation.lng],
                  });
                  onPreview(item.slug);
                },
              }}
            />
          );
        })}
      </MapContainer>
      {previewed ? (
        <>
          <CloseOnEscape
            onClose={() => {
              onPreview(null);
            }}
          />
          <Preview
            venue={previewed}
            onClose={() => {
              onPreview(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
