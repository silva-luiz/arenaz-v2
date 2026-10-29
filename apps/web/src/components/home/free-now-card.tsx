'use client';

import { availabilitySchema, type PublicVenueCard } from '@arenaz/contracts';
import { FOCUS_RING, cn } from '@arenaz/ui';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/ui/next-link';
import { apiSend } from '@/lib/api-client';
import { todayInZone } from '@/lib/zoned-time';
import { HomeVenueCard } from './home-venue-card';
import { BIG_CARD_SIZES } from './styles';
import {
  HOME_TIME_ZONE,
  freeStartHref,
  nextFreeStarts,
  type FreeStarts,
} from './tonight';

export interface FreeNowCardProps {
  venue: PublicVenueCard;
  /** What the server already loaded; used when it is for this venue. */
  initial: FreeStarts | null;
}

/**
 * MobileHome's big card: one venue with its next three free times, each a
 * link to the venue page with that time chosen. The times are left out when
 * the venue has nothing free today or the availability cannot be loaded.
 */
export function FreeNowCard({ venue, initial }: FreeNowCardProps) {
  const fromServer = initial?.slug === venue.slug ? initial : null;
  const [loaded, setLoaded] = useState<FreeStarts | null>(fromServer);
  const freeToday = venue.nextFreeTime !== null;

  useEffect(() => {
    if (!freeToday || fromServer || loaded?.slug === venue.slug) return;
    let alive = true;
    const date = todayInZone(HOME_TIME_ZONE);
    void apiSend(
      'GET',
      `/venues/${venue.slug}/availability?date=${date}`,
      undefined,
      availabilitySchema,
    ).then((result) => {
      if (!alive || !result.ok) return;
      setLoaded({
        slug: venue.slug,
        date: result.data.date,
        starts: nextFreeStarts(result.data, Date.now()),
      });
    });
    return () => {
      alive = false;
    };
  }, [freeToday, fromServer, loaded?.slug, venue.slug]);

  const current = fromServer ?? (loaded?.slug === venue.slug ? loaded : null);
  const starts = freeToday && current ? current.starts : [];

  return (
    <div>
      <HomeVenueCard
        venue={venue}
        imageSizes={BIG_CARD_SIZES}
        className="text-[15px]"
      />
      {current && starts.length > 0 ? (
        <ul
          aria-label="Próximos horários livres"
          className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {starts.map((start) => (
            <li key={start.startsAt} className="shrink-0">
              <AppLink
                href={freeStartHref(venue.slug, current.date, start)}
                aria-label={`Reservar ${venue.name} às ${start.time}`}
                className={cn(
                  'inline-flex h-11 items-center rounded-[10px] border border-line-strong px-3 font-mono text-[13px] font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
                  FOCUS_RING,
                )}
              >
                {start.time}
              </AppLink>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
