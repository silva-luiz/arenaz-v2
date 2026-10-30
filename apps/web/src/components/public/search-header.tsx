'use client';

import { SPORT_LABELS, SPORTS } from '@arenaz/contracts';
import { SearchBar, cn } from '@arenaz/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeSearchParams,
  saoPauloDate,
  type SearchParams,
} from '@/lib/search-query';
import { SearchFilters } from './search-filters';

/** The search as the URL has it (validated, never throws). */
function useSearchState(): SearchParams {
  const searchParams = useSearchParams();
  return useMemo(
    () => normalizeSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams],
  );
}

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short',
});

function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** "Hoje", "Amanhã", "Sex, 30/10" or "Qualquer dia". */
function whenLabel(data: string | undefined, today: string): string {
  if (!data) return 'Qualquer dia';
  if (data === today) return 'Hoje';
  if (data === addDays(today, 1)) return 'Amanhã';
  const [, month = '', day = ''] = data.split('-');
  const weekday = WEEKDAY.format(new Date(`${data}T00:00:00Z`)).replace(
    '.',
    '',
  );
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}/${month}`;
}

function whatLabel(params: SearchParams): string {
  const sport = SPORTS.find((candidate) => candidate === params.sport);
  const label = sport ? SPORT_LABELS[sport] : 'Qualquer esporte';
  return params.jogadores ? `${label} · ${params.jogadores}` : label;
}

const DIVIDER = (
  <span
    aria-hidden="true"
    className="h-[22px] w-px shrink-0 bg-line-strong max-md:hidden"
  />
);

/**
 * The prototype's compact search pill, in the header of the search page:
 * "Vila Madalena | Hoje | Society · 14" and a green magnifier. It is the
 * summary of a `<details>` (so it opens without JavaScript too) whose panel is
 * the full search form, with the real inputs prefilled from the URL (or from
 * `seed`). Esc, a click outside or submitting closes it. On a phone only the
 * place shows.
 */
export function SearchSummary({
  seed,
}: {
  /**
   * The search to show instead of the URL's: a venue page hands its
   * neighborhood, day and sport (Quadra.dc.html).
   */
  seed?: SearchParams | undefined;
} = {}) {
  const fromUrl = useSearchState();
  const params = seed ?? fromUrl;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (detailsRef.current) detailsRef.current.open = false;
      summaryRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !detailsRef.current?.contains(event.target)
      ) {
        if (detailsRef.current) detailsRef.current.open = false;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const place =
    params.q ??
    (params.lat !== undefined && params.lng !== undefined
      ? 'Perto de você'
      : 'Qualquer lugar');
  const when = whenLabel(params.data, saoPauloDate(new Date()));
  const what = whatLabel(params);

  // Filters the bar has no field for ride along, so a new search keeps them.
  const carried: Record<string, string> = {};
  if (params.amenities) carried.amenities = params.amenities;
  if (params.maxPrice) carried.maxPrice = params.maxPrice;

  return (
    <details
      ref={detailsRef}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
      className="group/search min-w-0 max-w-full max-md:flex-1"
    >
      <summary
        ref={summaryRef}
        className={cn(
          'flex h-12 w-full cursor-pointer list-none items-center gap-3 rounded-full border border-line-strong bg-bg pr-[7px] pl-[22px] text-sm font-semibold text-ink shadow-1 transition-shadow duration-150 hover:shadow-2 motion-reduce:transition-none [&::-webkit-details-marker]:hidden',
          'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink',
        )}
      >
        <span className="sr-only">Alterar a busca: </span>
        <span className="min-w-0 truncate">{place}</span>
        {DIVIDER}
        <span className="whitespace-nowrap max-md:hidden">{when}</span>
        {DIVIDER}
        <span className="font-normal whitespace-nowrap text-muted max-md:hidden">
          {what}
        </span>
        <span
          aria-hidden="true"
          className="ml-auto grid size-[34px] shrink-0 place-items-center rounded-full bg-brand"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </span>
      </summary>
      {/* Fixed under the bar (64px; 84px from md), whatever the pill's width. */}
      <div className="fixed inset-x-4 top-[72px] z-50 mx-auto max-h-[calc(100dvh-5.5rem)] max-w-4xl overflow-y-auto rounded-card bg-bg shadow-3 md:top-[92px] md:overflow-visible md:bg-transparent md:shadow-none">
        <SearchBar
          defaultQuery={params.q}
          defaultSport={SPORTS.find((candidate) => candidate === params.sport)}
          defaultDate={params.data}
          defaultPlayers={params.jogadores}
          extraFields={carried}
        />
      </div>
    </details>
  );
}

/**
 * The filter pills in the sticky header, under the bar: 60px tall (see
 * `--search-header-h` in globals.css), so the map can start right under it.
 */
export function SearchHeaderFilters() {
  const params = useSearchState();
  return (
    <div className="grid h-[60px] grid-cols-[minmax(0,1fr)] content-center">
      <SearchFilters params={params} />
    </div>
  );
}
