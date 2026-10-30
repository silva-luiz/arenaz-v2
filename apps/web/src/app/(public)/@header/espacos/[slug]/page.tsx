import { Suspense } from 'react';
import { SearchSummary } from '@/components/public/search-header';
import { loadPublicVenue } from '@/lib/public-venue';
import {
  normalizeSearchParams,
  saoPauloDate,
  type SearchParams,
} from '@/lib/search-query';

type QueryParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<QueryParams>;
}

/**
 * `@header` slot of a venue page: the compact search pill of Quadra.dc.html,
 * "Vila Madalena | Hoje | Society", from the venue's neighborhood, the day of
 * the link (`?data`, else today) and the sport of its first court. Its panel
 * searches from there. Nothing when the venue does not exist (the page itself
 * answers 404).
 */
export default async function VenueHeaderSearch({
  params,
  searchParams,
}: Props) {
  const [{ slug }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<QueryParams>({}),
  ]);
  const venue = await loadPublicVenue(slug);
  if (!venue) return null;

  const intent = normalizeSearchParams({
    data: query.data,
    jogadores: query.jogadores,
  });
  const sport = venue.fields[0]?.sports[0];
  const seed: SearchParams = {
    q: venue.neighborhood,
    data: intent.data ?? saoPauloDate(new Date()),
    ...(sport ? { sport } : {}),
    ...(intent.jogadores ? { jogadores: intent.jogadores } : {}),
  };
  return (
    // The pill reads the URL when no seed is given; with one it still uses
    // the hook, which needs a Suspense boundary on a dynamic page.
    <Suspense fallback={null}>
      <SearchSummary seed={seed} />
    </Suspense>
  );
}
