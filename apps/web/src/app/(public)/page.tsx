import {
  availabilitySchema,
  publicSearchResponseSchema,
  type PublicVenueCard,
} from '@arenaz/contracts';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import { HomeHero } from '@/components/home/home-hero';
import {
  DEFAULT_HOME_SPORT,
  WEEKEND_SPORTS,
  homeSportQuery,
} from '@/components/home/home-sports';
import { HomeTonight } from '@/components/home/home-tonight';
import { OpenGames } from '@/components/home/open-games';
import { OwnerBanner } from '@/components/home/owner-banner';
import { RailSection } from '@/components/home/rail-section';
import {
  HOME_TIME_ZONE,
  RAIL_LIMIT,
  nextFreeStarts,
  pickTonight,
  type FreeStarts,
} from '@/components/home/tonight';
import { publicGet } from '@/lib/public-api';
import { todayInZone } from '@/lib/zoned-time';

const TITLE = 'ArenaZ — reserve quadras perto de você';
const DESCRIPTION =
  'Encontre quadras de society, futsal, padel, beach tennis e mais perto de você e reserve na hora.';

export const metadata: Metadata = {
  // `absolute`: the root template would otherwise append " · arenaz".
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'ArenaZ',
    url: '/',
  },
};

/** One `/venues` page, or `null` when the API cannot be reached. */
async function loadVenues(query: string): Promise<PublicVenueCard[] | null> {
  try {
    const result = await publicGet(
      `/venues?${query}`,
      publicSearchResponseSchema,
    );
    return result ? result.items : null;
  } catch (error) {
    unstable_rethrow(error);
    console.error('Não foi possível carregar os espaços da home', error);
    return null;
  }
}

/**
 * "Areia, raquete e sol": one search per sport (the API filters one sport at
 * a time), merged in the prototype's order without repeating a venue.
 */
async function loadWeekend(): Promise<PublicVenueCard[]> {
  const pages = await Promise.all(
    WEEKEND_SPORTS.map((sport) => loadVenues(`sport=${sport}`)),
  );
  const seen = new Set<string>();
  const merged: PublicVenueCard[] = [];
  for (const venue of pages.flatMap((items) => items ?? [])) {
    if (seen.has(venue.slug)) continue;
    seen.add(venue.slug);
    merged.push(venue);
  }
  return merged.slice(0, RAIL_LIMIT);
}

/** Next free times of the venue the mobile card shows first. */
async function loadFreeStarts(
  items: PublicVenueCard[] | null,
): Promise<FreeStarts | null> {
  const first = items ? pickTonight(items).items[0] : undefined;
  if (!first || first.nextFreeTime === null) return null;
  try {
    const date = todayInZone(HOME_TIME_ZONE);
    const availability = await publicGet(
      `/venues/${first.slug}/availability?date=${date}`,
      availabilitySchema,
    );
    if (!availability) return null;
    return {
      slug: first.slug,
      date: availability.date,
      starts: nextFreeStarts(availability, Date.now()),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Não foi possível carregar os horários da home', error);
    return null;
  }
}

/**
 * The home of the approved prototype: Main.dc.html from md up,
 * MobileHome.dc.html below (the hero gives way to the "Bora jogar?" pill and
 * the rail to one big card with its next free times).
 */
export default async function HomePage() {
  // The layout already makes this route dynamic (it reads the session cookie),
  // but Next renders layout and page side by side while prerendering: wait for
  // a real request so `next build` never calls the API.
  await connection();
  const [tonight, weekend] = await Promise.all([
    loadVenues(homeSportQuery(DEFAULT_HOME_SPORT)),
    loadWeekend(),
  ]);
  const starts = await loadFreeStarts(tonight);

  return (
    <div className="flex flex-col pb-12 md:-mt-6">
      <HomeHero />
      <HomeTonight initialItems={tonight} initialStarts={starts} />
      <div className="mt-7 flex flex-col gap-7 md:mt-[60px] md:gap-[60px]">
        <OpenGames />
        {weekend.length > 0 ? (
          <RailSection
            title="Areia, raquete e sol pro fim de semana"
            href="/buscar"
            items={weekend}
          />
        ) : null}
        <OwnerBanner />
      </div>
    </div>
  );
}
