import {
  AMENITIES,
  publicSearchQuerySchema,
  type Amenity,
  type PublicSearchQuery,
} from '@arenaz/contracts';
import { toSearchParams } from './query-string';

export const SEARCH_PATH = '/buscar';

/** What Next hands a page: repeated keys arrive as arrays. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const KEYS = [
  'q',
  'sport',
  'lat',
  'lng',
  'radiusKm',
  'amenities',
  'maxPrice',
  'data',
  'jogadores',
  'page',
] as const;
export type SearchKey = (typeof KEYS)[number];

/**
 * Intent that only travels: the day and the group size the player picked in
 * the search bar. The API cannot filter by them, so they are kept in the URL
 * and handed to the venue page, never sent to the API.
 */
const INTENT_KEYS = ['data', 'jogadores'] as const;
const INTENT = new Set<string>(INTENT_KEYS);

/** Farthest day ahead the booking flow accepts. */
const MAX_DAYS_AHEAD = 60;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 30;

/** The search filters as the user typed them: trimmed, never empty. */
export type SearchParams = Partial<Record<SearchKey, string>>;

const COORDINATES = new Set<SearchKey>(['lat', 'lng']);
const TIME_ZONE = 'America/Sao_Paulo';
const COORDINATE_DECIMALS = 3;

/**
 * Rounds a coordinate to 3 decimals (about 110 m), so a crawler cannot create
 * one cache entry per distinct position. Text that is not a finite number is
 * left alone for the schema to reject.
 */
function roundCoordinate(text: string): string {
  const value = Number(text);
  if (!Number.isFinite(value)) return text;
  return String(Number(value.toFixed(COORDINATE_DECIMALS)));
}

/** The calendar day in São Paulo, "YYYY-MM-DD" (en-CA formats it that way). */
export function saoPauloDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `date` plus `days`, as "YYYY-MM-DD" (calendar arithmetic in UTC). */
function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** A real day from today to today + 60 (São Paulo), or `undefined`. */
function validDate(text: string, now: Date): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const today = saoPauloDate(now);
  // Round trip rejects 2026-02-30. ISO dates compare as strings.
  if (addDays(text, 0) !== text) return undefined;
  return text >= today && text <= addDays(today, MAX_DAYS_AHEAD)
    ? text
    : undefined;
}

/** A whole number from 2 to 30, written without sign, decimals or padding. */
function validPlayers(text: string): string | undefined {
  if (!/^\d{1,2}$/.test(text)) return undefined;
  const count = Number(text);
  return count >= MIN_PLAYERS && count <= MAX_PLAYERS
    ? String(count)
    : undefined;
}

/**
 * Keeps the first value of each known key, trimmed, and drops empty ones. A
 * form submitted without JavaScript sends `?q=&sport=`; that is "no filter",
 * not an invalid search. `data` and `jogadores` are only intent: a value out
 * of range is dropped instead of failing the search.
 */
export function normalizeSearchParams(
  raw: RawSearchParams,
  now: Date = new Date(),
): SearchParams {
  const params: SearchParams = {};
  for (const key of KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const text = first?.trim();
    if (!text) continue;
    if (key === 'data') {
      const date = validDate(text, now);
      if (date) params.data = date;
    } else if (key === 'jogadores') {
      const players = validPlayers(text);
      if (players) params.jogadores = players;
    } else {
      params[key] = COORDINATES.has(key) ? roundCoordinate(text) : text;
    }
  }
  return params;
}

export type ParsedSearch =
  | { ok: true; params: SearchParams; query: PublicSearchQuery }
  | {
      ok: false;
      params: SearchParams;
      /** pt-BR message of each invalid field (the first one it has). */
      messages: Partial<Record<SearchKey, string>>;
    };

/** Normalizes, then validates with the same schema the API uses. */
export function parseSearch(
  raw: RawSearchParams,
  now: Date = new Date(),
): ParsedSearch {
  const params = normalizeSearchParams(raw, now);
  const result = publicSearchQuerySchema.safeParse(params);
  if (result.success) return { ok: true, params, query: result.data };

  const messages: Partial<Record<SearchKey, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== 'string' || !(KEYS as readonly string[]).includes(key)) {
      continue;
    }
    messages[key as SearchKey] ??= issue.message;
  }
  return { ok: false, params, messages };
}

/** `/buscar` with the given filters; `page` 1 is left out. */
export function searchHref(params: SearchParams, page: number): string {
  const query = toSearchParams({
    ...params,
    page: page > 1 ? page : undefined,
  }).toString();
  return query ? `${SEARCH_PATH}?${query}` : SEARCH_PATH;
}

/** What the API understands: the filters without date and players. */
export function apiQuery(params: SearchParams): SearchParams {
  const query: SearchParams = {};
  for (const key of KEYS) {
    const value = params[key];
    if (value !== undefined && !INTENT.has(key)) query[key] = value;
  }
  return query;
}

/**
 * The venue page for a result. It carries the day and the group size from
 * the search (`?data=..&jogadores=..`) so the booking card can start there.
 */
export function venueHref(slug: string, params: SearchParams): string {
  const query = toSearchParams({
    data: params.data,
    jogadores: params.jogadores,
  }).toString();
  return query ? `/espacos/${slug}?${query}` : `/espacos/${slug}`;
}

/**
 * The venue page with one of today's free times chosen: the card's time chips.
 * The day is today (free times are today's, whatever day the search asked
 * for), `hora` is "HH:MM" and the group size from the search rides along.
 */
export function slotHref(
  slug: string,
  time: string,
  today: string,
  params: Pick<SearchParams, 'jogadores'>,
): string {
  const query = toSearchParams({
    data: today,
    hora: time,
    jogadores: params.jogadores,
  }).toString();
  return `/espacos/${slug}?${query}`;
}

/** The amenities in the URL, in the order the user turned them on. */
export function amenitiesOf(params: SearchParams): Amenity[] {
  const known = new Set<string>(AMENITIES);
  return (params.amenities ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is Amenity => known.has(item));
}

/**
 * Filters with one amenity turned on or off. Any other filter stays, the page
 * goes back to the first (the results changed).
 */
export function withAmenity(
  params: SearchParams,
  amenity: Amenity,
  on: boolean,
): SearchParams {
  const rest = amenitiesOf(params).filter((item) => item !== amenity);
  const amenities = (on ? [...rest, amenity] : rest).join(',');
  const next: SearchParams = { ...params };
  delete next.page;
  delete next.amenities;
  if (amenities) next.amenities = amenities;
  return next;
}

/** The "Até R$ 200/h" chip. */
export const PRICE_CHIP_REAIS = 200;

/** Filters with the price ceiling set (`reais`) or cleared (`undefined`). */
export function withMaxPrice(
  params: SearchParams,
  reais: number | undefined,
): SearchParams {
  const next: SearchParams = { ...params };
  delete next.page;
  delete next.maxPrice;
  if (reais !== undefined) next.maxPrice = String(reais);
  return next;
}
