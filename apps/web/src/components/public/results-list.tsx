'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { FOCUS_RING, VenueCard, cn } from '@arenaz/ui';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { AppLink } from '@/components/ui/next-link';

// Leaflet touches `window` on import, so the map is client-only.
const ResultsMap = dynamic(() => import('./results-map'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="size-full animate-pulse rounded-card bg-surface motion-reduce:animate-none"
    />
  ),
});

type View = 'list' | 'map';

const TOGGLE_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none';

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        TOGGLE_BUTTON,
        FOCUS_RING,
        // Outline on the pill's own dark background would vanish: offset it
        // outside the pill with a white gap.
        'focus-visible:outline-white',
        pressed ? 'bg-white text-ink' : 'text-white',
      )}
    >
      {children}
    </button>
  );
}

export interface ResultsListProps {
  items: PublicVenueCard[];
  /**
   * Search bar and title. They sit above the cards, in the left column, so
   * the map can start at the top of the page; on a phone they leave with the
   * list, so the map view is the whole screen.
   */
  header?: ReactNode;
  /** Rendered under the cards ("Carregar mais"). Hidden with the list. */
  footer?: ReactNode;
}

/**
 * The cards of the search plus the map that shows the same venues.
 *
 * From `lg` up they sit side by side (cards left, sticky map right). Below
 * that only one is visible at a time and a floating "Lista" / "Mapa" switch
 * (two toggle buttons with `aria-pressed`, so the names never change) moves
 * between them. The hidden view is `display: none`, so it also leaves the tab
 * order and the accessibility tree.
 *
 * Hovering or focusing a card highlights its pin; clicking a pin opens the
 * preview. Both write the same `selectedSlug`.
 */
export function ResultsList({ items, header, footer }: ResultsListProps) {
  const [view, setView] = useState<View>('list');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-8">
        {header ? (
          <div
            data-testid="results-header"
            className={cn(
              'pb-6 lg:col-start-1',
              view === 'map' && 'hidden lg:block',
            )}
          >
            {header}
          </div>
        ) : null}
        <div
          data-testid="results-list-view"
          className={cn('lg:col-start-1', view === 'map' && 'hidden lg:block')}
        >
          <ul
            role="list"
            aria-label="Espaços encontrados"
            className="grid gap-x-5 gap-y-9 sm:grid-cols-2"
          >
            {items.map((venue) => (
              <li
                key={venue.slug}
                onMouseEnter={() => {
                  setSelectedSlug(venue.slug);
                }}
                onFocus={() => {
                  setSelectedSlug(venue.slug);
                }}
              >
                <VenueCard
                  href={`/espacos/${venue.slug}`}
                  name={venue.name}
                  neighborhood={venue.neighborhood}
                  city={venue.city}
                  coverUrl={venue.coverUrl}
                  sports={venue.sports}
                  minPriceCentsPerHour={venue.minPriceCentsPerHour}
                  distanceKm={venue.distanceKm}
                  linkComponent={AppLink}
                />
              </li>
            ))}
          </ul>
          {footer}
        </div>

        <div
          data-testid="results-map-view"
          className={cn(
            // Phone: the screen minus header (65px), tab bar (57px) and gaps.
            'h-[calc(100dvh-9.5rem)] min-h-80 lg:sticky lg:top-[97px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-8rem)] lg:self-start',
            view === 'list' && 'hidden lg:block',
          )}
        >
          <ResultsMap
            items={items}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>
      </div>

      <div
        role="group"
        aria-label="Ver como"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-ink p-1 shadow-3 md:bottom-6 lg:hidden"
      >
        <ToggleButton
          pressed={view === 'list'}
          onClick={() => {
            setView('list');
          }}
        >
          Lista
        </ToggleButton>
        <ToggleButton
          pressed={view === 'map'}
          onClick={() => {
            setView('map');
          }}
        >
          Mapa
        </ToggleButton>
      </div>
    </>
  );
}
