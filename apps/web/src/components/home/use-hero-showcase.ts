'use client';

import { nextBookingResponseSchema } from '@arenaz/contracts';
import { useEffect, useMemo, useState } from 'react';
import {
  HERO_SHOWCASE_MOCK,
  type HeroBookingShowcase,
  type HeroShowcase,
} from './hero-showcase';

/**
 * What the hero cards show: the illustration first (the server HTML, shared by
 * everyone), then, for a signed-in player, their next confirmed booking read
 * in the browser. No booking, an expired session, an error or a body out of
 * contract all keep the illustration, without any message.
 *
 * Plain `fetch`, not `apiSend`: a 401 here only means "show the
 * illustration", never "go sign in".
 */
export function useHeroShowcase(signedIn: boolean): HeroShowcase {
  const [booking, setBooking] = useState<HeroBookingShowcase | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/api/bookings/me/next', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const parsed = nextBookingResponseSchema.safeParse(
          await response.json(),
        );
        const next = parsed.success ? parsed.data.booking : null;
        // A cleanup that ran while the body was read: this answer is stale.
        if (!next || controller.signal.aborted) return;
        setBooking({
          venueName: next.venueName,
          when: next.when,
          code: next.code,
          photoUrl: next.coverUrl ?? HERO_SHOWCASE_MOCK.booking.photoUrl,
        });
      } catch {
        // Offline, aborted or not JSON: the illustration stays.
      }
    }

    void load();
    return () => {
      controller.abort();
    };
  }, [signedIn]);

  // Signed out again while mounted: back to the illustration.
  return useMemo(
    () =>
      signedIn && booking
        ? { ...HERO_SHOWCASE_MOCK, booking }
        : HERO_SHOWCASE_MOCK,
    [signedIn, booking],
  );
}
