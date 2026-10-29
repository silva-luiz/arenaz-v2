'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { VenueCard } from '@arenaz/ui';
import { AppLink } from '@/components/ui/next-link';
import { demoVenueExtras } from '@/lib/demo';
import { venueCardMeta } from '@/lib/venue-card-meta';

export interface SearchVenueCardProps {
  venue: PublicVenueCard;
  /** The venue page, with the date and players of the search. */
  href: string;
  /** `sizes` of the cover for the grid the card sits in. */
  imageSizes: string;
  /** This venue is the selected one on the map. */
  selected: boolean;
  onToggleSelected: () => void;
}

/**
 * A result of the search: the real card data plus the demo-only rating (like
 * the home's `HomeVenueCard`, which has the heart instead of this card's "show
 * on the map" pin button, as in the prototype). No badge: the prototype's
 * search cards have none.
 */
export function SearchVenueCard({
  venue,
  href,
  imageSizes,
  selected,
  onToggleSelected,
}: SearchVenueCardProps) {
  return (
    <VenueCard
      href={href}
      name={venue.name}
      imageUrl={venue.coverUrl}
      imageAlt=""
      imageSrcSet={venue.coverSrcSet}
      imageSizes={imageSizes}
      meta={venueCardMeta(venue)}
      priceCents={venue.minPriceCentsPerHour}
      priceFrom
      nextFreeTime={venue.nextFreeTime}
      rating={demoVenueExtras(venue.slug)?.rating}
      showOnMap={{
        pressed: selected,
        label: `Mostrar ${venue.name} no mapa`,
        onToggle: onToggleSelected,
      }}
      linkComponent={AppLink}
    />
  );
}
