import {
  DEMO_MARKETING_COUNTERS,
  DEMO_OPEN_GAMES,
  DEMO_OWNER_STATS,
  DEMO_VENUE_EXTRAS,
  type DemoOpenGame,
  type DemoOwnerStats,
  type DemoVenueExtras,
} from './fixtures';

export type {
  DemoOpenGame,
  DemoOwnerStats,
  DemoReview,
  DemoSubRating,
  DemoVenueExtras,
} from './fixtures';

/**
 * Fictional data (ratings, reviews, open games, owner numbers, marketing
 * counters) exists only in the demo mode. The venue extras and open games are
 * `null`/empty otherwise; the owner numbers and marketing counters are plain
 * constants, so screens must check `isDemoMode` before rendering them.
 *
 * The literal `process.env.NEXT_PUBLIC_DEMO_MODE` access is required: Next
 * inlines `NEXT_PUBLIC_*` at build time only for that exact expression.
 */
export const isDemoMode: boolean = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Slugs of the demo seed that have a fixture. */
export const DEMO_VENUE_SLUGS: readonly string[] =
  Object.keys(DEMO_VENUE_EXTRAS);

/** `null` outside the demo mode, or for a slug without a fixture. */
export function demoVenueExtras(slug: string): DemoVenueExtras | null {
  if (!isDemoMode) return null;
  return Object.hasOwn(DEMO_VENUE_EXTRAS, slug)
    ? (DEMO_VENUE_EXTRAS[slug] ?? null)
    : null;
}

/** "Falta gente": empty outside the demo mode. */
export const demoOpenGames: readonly DemoOpenGame[] = isDemoMode
  ? DEMO_OPEN_GAMES
  : [];

/** Painel numbers. Only render them when `isDemoMode`. */
export const demoOwnerStats: DemoOwnerStats = DEMO_OWNER_STATS;

/** Home marketing counters. Only render them when `isDemoMode`. */
export const demoMarketingCounters = DEMO_MARKETING_COUNTERS;

/** "Falta 1" / "Faltam 2". */
export function missingLabel(count: number): string {
  return count === 1 ? 'Falta 1' : `Faltam ${String(count)}`;
}
