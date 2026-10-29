'use client';

import { SPORT_LABELS, SPORTS } from '@arenaz/contracts';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Alert } from './alert';
import { cn } from './cn';
import { FOCUS_RING } from './link';

export interface SearchBarProps {
  defaultQuery?: string | undefined;
  defaultSport?: string | undefined;
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

function navigateTo(url: string) {
  window.location.assign(url);
}

/*
 * The field wrappers are cards on mobile (bordered, 3:1 against the page) and
 * borderless pill segments from md up. The focus indicator sits on the label
 * because the inner control has no box of its own.
 */
const SEGMENT =
  'flex min-w-0 flex-1 flex-col rounded-button border border-line-control px-4 py-2 transition-colors duration-150 hover:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand motion-reduce:transition-none md:rounded-full md:border-0 md:px-6';
const SEGMENT_LABEL = 'text-xs font-semibold text-ink';
const SEGMENT_CONTROL =
  'w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted';

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-8 w-px shrink-0 bg-line-strong md:block"
    />
  );
}

/**
 * Search pill. The form is a plain GET (`q`, `sport`) so it works without
 * JavaScript; "Perto de mim" is the only client enhancement (browser
 * geolocation, then navigation to `action?lat=..&lng=..[&sport=..]` with 3
 * decimals, about 100 m). Without JS the empty fields are still sent (`q=`,
 * `sport=`), so the search page must treat empty values as absent; with JS
 * they are left out of the URL on submit.
 */
export function SearchBar({
  defaultQuery,
  defaultSport,
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
        const sport = formRef.current
          ? formRef.current.elements.namedItem('sport')
          : null;
        if (sport instanceof HTMLSelectElement && sport.value) {
          params.set('sport', sport.value);
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
        className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4 shadow-3 md:flex-row md:items-center md:gap-1 md:rounded-full md:border-0 md:p-2"
      >
        <label className={cn(SEGMENT, 'md:flex-[1.3]')}>
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
        <Divider />
        {/* md:flex-none: as wide as the longest option ("Qualquer esporte"),
            not squeezed by the text field next to it. */}
        <label className={cn(SEGMENT, 'md:flex-none')}>
          <span className={SEGMENT_LABEL}>Esporte</span>
          <select
            name="sport"
            defaultValue={defaultSport ?? ''}
            className={cn(SEGMENT_CONTROL, 'cursor-pointer')}
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
        <div className="flex flex-col gap-2 sm:flex-row md:gap-1">
          <button
            type="button"
            onClick={findNearby}
            aria-busy={locating ? true : undefined}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-control bg-bg px-5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none md:border-0',
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
            Perto de mim
          </button>
          <button
            type="submit"
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-white transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--color-brand)_88%,black)] motion-reduce:transition-none',
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
