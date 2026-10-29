'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { FOCUS_RING, cn } from '@arenaz/ui';
import dynamic from 'next/dynamic';
import { useRef, useState, type ReactNode, type Ref } from 'react';
import { venueHref, type SearchParams } from '@/lib/search-query';
import { SearchVenueCard } from './search-venue-card';

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
  buttonRef,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
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

/*
 * Cover `sizes` of the result cards: 1 column, 2 from sm; from lg the list is
 * the 1fr beside a 34% map column inside the page content (1360px max, 16px /
 * 40px gutters from md, 32px gap), with auto-filled columns of at least 230px
 * (2 up to about 1235px, then 3) and 20px between cards.
 */
const CARD_SIZES =
  '(min-width: 1360px) 257px, (min-width: 1235px) calc(22vw - 42px), (min-width: 1024px) calc(33vw - 52px), (min-width: 640px) calc(50vw - 26px), calc(100vw - 32px)';

export interface ResultsListProps {
  items: PublicVenueCard[];
  /** Day and players of the search: carried on every link to a venue. */
  intent?: Pick<SearchParams, 'data' | 'jogadores'> | undefined;
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
 * Two separate pieces of state: hovering or focusing a card only highlights
 * its pin (and lets go on leave or blur); the selection (dark pin, preview,
 * ringed card) is made on purpose, with the pin or the card's "Mostrar no
 * mapa" button, and cleared with the preview's button, a click on the map,
 * Esc or the same card button again.
 */
export function ResultsList({
  items,
  intent = {},
  header,
  footer,
}: ResultsListProps) {
  const [view, setView] = useState<View>('list');
  const mapToggleRef = useRef<HTMLButtonElement>(null);
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  // One selection for both ways in: the pin, or the card's "show on the map".
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  function hrefFor(slug: string): string {
    return venueHref(slug, intent);
  }

  function toggleFromCard(slug: string) {
    if (previewSlug === slug) {
      setPreviewSlug(null);
      return;
    }
    setPreviewSlug(slug);
    // On a phone the card's button is in the list, which the map replaces:
    // follow the user there, and keep focus on a control that still exists.
    setView('map');
    mapToggleRef.current?.focus();
  }

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_34%] lg:grid-rows-[auto_1fr] lg:gap-x-8">
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
            className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-x-5 gap-y-9"
          >
            {items.map((venue) => (
              <li
                key={venue.slug}
                onMouseEnter={() => {
                  setHoverSlug(venue.slug);
                }}
                onMouseLeave={() => {
                  setHoverSlug(null);
                }}
                onFocus={() => {
                  setFocusSlug(venue.slug);
                }}
                onBlur={() => {
                  setFocusSlug(null);
                }}
              >
                <SearchVenueCard
                  venue={venue}
                  href={hrefFor(venue.slug)}
                  imageSizes={CARD_SIZES}
                  selected={previewSlug === venue.slug}
                  onToggleSelected={() => {
                    toggleFromCard(venue.slug);
                  }}
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
            'h-[calc(100dvh-9.5rem)] min-h-80 lg:sticky lg:top-[108px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100dvh-132px)] lg:self-start',
            view === 'list' && 'hidden lg:block',
          )}
        >
          <ResultsMap
            items={items}
            hoveredSlug={hoverSlug ?? focusSlug}
            previewSlug={previewSlug}
            onPreview={setPreviewSlug}
            hrefFor={hrefFor}
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
          buttonRef={mapToggleRef}
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
