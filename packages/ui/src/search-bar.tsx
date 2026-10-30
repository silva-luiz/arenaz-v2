'use client';

import { SPORT_LABELS, SPORTS } from '@arenaz/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Alert } from './alert';
import { cn } from './cn';
import { FOCUS_RING } from './link';

export interface SearchBarProps {
  defaultQuery?: string | undefined;
  defaultSport?: string | undefined;
  /** "YYYY-MM-DD" preselected in "Quando". Default: none ("Qualquer dia"). */
  defaultDate?: string | undefined;
  /** Preselected "Jogadores" ("14"). Default: none. */
  defaultPlayers?: string | undefined;
  /** "YYYY-MM-DD" of today. Default: today in São Paulo. */
  today?: string | undefined;
  /**
   * Filters of the page the bar sits on that the bar has no field for
   * (amenities, price ceiling): sent as hidden inputs, so a new search keeps
   * them. Empty values are left out.
   */
  extraFields?: Readonly<Record<string, string>> | undefined;
  /** Search page. Must not carry a query string of its own. */
  action?: string;
  /** Called with the URL "Perto de mim" resolves to. Default: full navigation. */
  onNavigate?: ((url: string) => void) | undefined;
  className?: string | undefined;
}

const LOCATION_ERROR = 'Não conseguimos sua localização';
const SEARCHING = 'Buscando sua localização…';
const GEOLOCATION_TIMEOUT_MS = 10_000;
// Slightly longer than the geolocation timeout: Firefox fires no callback at
// all when the permission prompt is dismissed, so we cannot rely on one.
const FALLBACK_TIMEOUT_MS = 12_000;

const DATE_DAYS = 7;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

/** Today in São Paulo, "YYYY-MM-DD" (en-CA formats dates that way). */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short',
});

/**
 * "Qualquer dia", "Hoje", "Amanhã", then "Sáb, 31/10" for the next five
 * days. Calendar arithmetic in UTC, so no zone can shift a day.
 */
function dateOptions(
  today: string,
  selected?: string,
): { value: string; label: string }[] {
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number);
  const options = [{ value: '', label: 'Qualquer dia' }];
  const label = (date: Date, offset: number): string => {
    const [, mm = '', dd = ''] = date.toISOString().slice(0, 10).split('-');
    const weekday = WEEKDAY.format(date).replace('.', '');
    return offset === 0
      ? 'Hoje'
      : offset === 1
        ? 'Amanhã'
        : `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dd}/${mm}`;
  };
  for (let offset = 0; offset < DATE_DAYS; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    options.push({
      value: date.toISOString().slice(0, 10),
      label: label(date, offset),
    });
  }
  // A day from the URL beyond the week still has to be selectable, or the
  // select would silently fall back to "Qualquer dia".
  if (selected && !options.some((option) => option.value === selected)) {
    const [y = 0, m = 1, d = 1] = selected.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(date.getTime())) {
      options.push({ value: selected, label: label(date, DATE_DAYS) });
    }
  }
  return options;
}

const PLAYER_COUNTS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, index) => String(MIN_PLAYERS + index),
);

function navigateTo(url: string) {
  window.location.assign(url);
}

/*
 * The field wrappers are cards on mobile (bordered, 3:1 against the page) and
 * borderless pill segments from md up, as in the prototype (label 12px over a
 * 15px value). The focus indicator sits on the label because the inner
 * control has no box of its own.
 */
const SEGMENT =
  'flex min-w-0 flex-1 flex-col rounded-button border border-line-control px-4 py-2 transition-colors duration-150 hover:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand motion-reduce:transition-none md:rounded-full md:border-0 md:px-[22px] md:py-3';
const SEGMENT_LABEL = 'text-xs font-semibold text-ink';
const SEGMENT_CONTROL =
  'mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted';
/*
 * Selects read like the prototype's segments from md up: no arrow, and the
 * "any" choice in the muted placeholder colour (a chosen value turns ink).
 */
const SEGMENT_SELECT = cn(
  SEGMENT_CONTROL,
  "cursor-pointer has-[option[value='']:checked]:text-muted md:appearance-none",
);

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-8 w-px shrink-0 bg-line-strong md:block"
    />
  );
}

/**
 * Search pill of the prototype: Onde · Quando · Esporte · Jogadores + Buscar.
 * The form is a plain GET (`q`, `data`, `sport`, `jogadores`) so it works
 * without JavaScript; "Perto de mim" is the only client enhancement (browser
 * geolocation, then navigation to `action?lat=..&lng=..` with 3 decimals,
 * about 100 m, plus every other filled field but `q`). Without JS the empty fields are still sent (`q=`,
 * `sport=`), so the search page must treat empty values as absent; with JS
 * they are left out of the URL on submit.
 */
export function SearchBar({
  defaultQuery,
  defaultSport,
  defaultDate,
  defaultPlayers,
  today,
  extraFields,
  action = '/buscar',
  onNavigate = navigateTo,
  className,
}: SearchBarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The button is never disabled (a request that never answers would lock it
  // for good); a ref guards double clicks and identifies the live request.
  const pendingRef = useRef(false);
  const attemptRef = useRef(0);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      clearTimeout(fallbackRef.current);
    },
    [],
  );

  /** Ends the live request; false if it was already over (late callback). */
  function settle(attempt: number): boolean {
    if (!pendingRef.current || attempt !== attemptRef.current) return false;
    pendingRef.current = false;
    clearTimeout(fallbackRef.current);
    setLocating(false);
    return true;
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    // Progressive enhancement: skip empty fields so the URL stays clean. They
    // are re-enabled right after the browser has built the form data (a
    // later task), so bfcache never restores a disabled form.
    const skipped: (HTMLInputElement | HTMLSelectElement)[] = [];
    for (const control of event.currentTarget.elements) {
      if (
        (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement) &&
        control.name &&
        !control.disabled &&
        control.value.trim() === ''
      ) {
        control.disabled = true;
        skipped.push(control);
      }
    }
    setTimeout(() => {
      for (const control of skipped) control.disabled = false;
    }, 0);
  }

  function findNearby() {
    if (pendingRef.current) return;
    setError(null);
    if (typeof navigator.geolocation === 'undefined') {
      setError(LOCATION_ERROR);
      return;
    }
    pendingRef.current = true;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setLocating(true);
    fallbackRef.current = setTimeout(() => {
      if (settle(attempt)) setError(LOCATION_ERROR);
    }, FALLBACK_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!settle(attempt)) return;
        const params = new URLSearchParams({
          lat: position.coords.latitude.toFixed(3),
          lng: position.coords.longitude.toFixed(3),
        });
        // The place is what "Perto de mim" replaces; every other filled
        // field (day, sport, players, carried filters) stays in the search.
        if (formRef.current) {
          for (const [name, value] of new FormData(formRef.current)) {
            if (name === 'q' || typeof value !== 'string') continue;
            if (value.trim() !== '') params.set(name, value);
          }
        }
        onNavigate(`${action}?${params.toString()}`);
      },
      () => {
        if (settle(attempt)) setError(LOCATION_ERROR);
      },
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <form
        ref={formRef}
        method="get"
        action={action}
        role="search"
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4 shadow-3 md:flex-row md:items-center md:gap-0 md:rounded-full md:border-0 md:p-2"
      >
        {Object.entries(extraFields ?? {}).map(([name, value]) =>
          value ? (
            <input key={name} type="hidden" name={name} value={value} />
          ) : null,
        )}
        <label className={cn(SEGMENT, 'md:flex-[1.3] md:pl-[26px]')}>
          <span className={SEGMENT_LABEL}>Onde</span>
          <input
            type="text"
            name="q"
            defaultValue={defaultQuery}
            placeholder="Cidade ou bairro"
            autoComplete="off"
            enterKeyHint="search"
            className={SEGMENT_CONTROL}
          />
        </label>
        {/* Icon only from md up (the text stays as its accessible name). */}
        <button
          type="button"
          onClick={findNearby}
          title="Perto de mim"
          aria-busy={locating ? true : undefined}
          className={cn(
            'inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-control bg-bg px-5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none md:size-11 md:border-0 md:px-0',
            FOCUS_RING,
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="1" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="23" />
            <line x1="1" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="23" y2="12" />
          </svg>
          <span className="md:sr-only">Perto de mim</span>
        </button>
        <Divider />
        <label className={SEGMENT}>
          <span className={SEGMENT_LABEL}>Quando</span>
          <select
            name="data"
            defaultValue={defaultDate ?? ''}
            className={SEGMENT_SELECT}
          >
            {dateOptions(today ?? todayInSaoPaulo(), defaultDate).map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>
        <Divider />
        {/* md:flex-none: as wide as the longest option ("Qualquer esporte"),
            not squeezed by the text field next to it. */}
        <label className={cn(SEGMENT, 'md:flex-none')}>
          <span className={SEGMENT_LABEL}>Esporte</span>
          <select
            name="sport"
            defaultValue={defaultSport ?? ''}
            className={SEGMENT_SELECT}
          >
            <option value="">Qualquer esporte</option>
            {SPORTS.map((sport) => (
              <option key={sport} value={sport}>
                {SPORT_LABELS[sport]}
              </option>
            ))}
          </select>
        </label>
        <Divider />
        {/* The prototype puts "Buscar" inside the last segment; a button
            cannot sit inside a <label>, so they are siblings in one row. */}
        <div className="flex flex-col gap-3 md:flex-[1.45] md:flex-row md:items-center md:gap-2">
          <label className={cn(SEGMENT, 'md:min-w-[7.5rem]')}>
            <span className={SEGMENT_LABEL}>Jogadores</span>
            <select
              name="jogadores"
              defaultValue={defaultPlayers ?? ''}
              className={SEGMENT_SELECT}
            >
              <option value="">Quantos?</option>
              {PLAYER_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {`${count} pessoas`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={cn(
              'inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-[22px] text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_22px_-8px_rgba(11,122,75,0.65)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--color-brand)_88%,black)] motion-reduce:transition-none',
              FOCUS_RING,
            )}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            Buscar
          </button>
        </div>
      </form>
      <p aria-live="polite" className="sr-only">
        {locating ? SEARCHING : ''}
      </p>
      <Alert tone="error" className="mt-3">
        {error}
      </Alert>
    </div>
  );
}
