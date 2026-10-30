import {
  DEMO_MARKETING_COUNTERS,
  DEMO_OPEN_GAMES,
  DEMO_OWNER_STATS,
  DEMO_SQUAD,
  DEMO_VENUE_EXTRAS,
  type DemoOpenGame,
  type DemoOwnerStats,
  type DemoSquadMember,
  type DemoVenueExtras,
} from './fixtures';

export type {
  DemoOpenGame,
  DemoOwnerStats,
  DemoReview,
  DemoSquadMember,
  DemoSubRating,
  DemoVenueExtras,
} from './fixtures';

/**
 * Fictional data (ratings, reviews, open games, owner numbers, marketing
 * counters) exists only in the demo mode. The venue extras and open games are
 * `null`/empty otherwise; the owner numbers and marketing counters are plain
 * constants, so screens must check `isDemoMode` before rendering them.
 *
 * The value is fixed when the app is built: `next.config.ts` sets
 * `env.NEXT_PUBLIC_DEMO_MODE` to 'true' or 'false', and Next replaces the
 * literal `process.env.NEXT_PUBLIC_DEMO_MODE` below with it in the server and
 * client bundles alike (so a server started with another value cannot
 * disagree with the browser). The literal expression is required for that.
 * Build with `NEXT_PUBLIC_DEMO_MODE=true` for the demo.
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

/** "Racha do time" of the checkout: empty outside the demo mode. */
export const demoSquad: readonly DemoSquadMember[] = isDemoMode
  ? DEMO_SQUAD
  : [];
