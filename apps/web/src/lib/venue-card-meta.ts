import type { PublicVenueCard } from '@arenaz/contracts';
import { SPORT_LABELS } from '@arenaz/contracts';
import { formatDistanceKm } from '@arenaz/ui';

/**
 * The line under a card's name: "Vila Madalena · Society · Futsal · 1,2 km".
 * The distance is there only for a search near a point.
 */
export function venueCardMeta(
  venue: Pick<PublicVenueCard, 'neighborhood' | 'sports' | 'distanceKm'>,
): string {
  const parts = [
    venue.neighborhood,
    ...venue.sports.map((sport) => SPORT_LABELS[sport]),
  ];
  if (venue.distanceKm !== null && Number.isFinite(venue.distanceKm)) {
    parts.push(formatDistanceKm(venue.distanceKm));
  }
  return parts.join(' · ');
}
