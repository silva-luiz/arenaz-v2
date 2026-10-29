import {
  publicSearchQuerySchema,
  type PublicSearchQuery,
} from '@arenaz/contracts';
import { toSearchParams } from './public-api';

export const SEARCH_PATH = '/buscar';

/** What Next hands a page: repeated keys arrive as arrays. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const KEYS = ['q', 'sport', 'lat', 'lng', 'radiusKm', 'page'] as const;
export type SearchKey = (typeof KEYS)[number];

/** The search filters as the user typed them: trimmed, never empty. */
export type SearchParams = Partial<Record<SearchKey, string>>;

const COORDINATES = new Set<SearchKey>(['lat', 'lng']);
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

/**
 * Keeps the first value of each known key, trimmed, and drops empty ones. A
 * form submitted without JavaScript sends `?q=&sport=`; that is "no filter",
 * not an invalid search.
 */
export function normalizeSearchParams(raw: RawSearchParams): SearchParams {
  const params: SearchParams = {};
  for (const key of KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const text = first?.trim();
    if (text) params[key] = COORDINATES.has(key) ? roundCoordinate(text) : text;
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
export function parseSearch(raw: RawSearchParams): ParsedSearch {
  const params = normalizeSearchParams(raw);
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
