'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { VenueCard } from '@arenaz/ui';
import { AppLink } from '@/components/ui/next-link';
import { demoVenueExtras, isDemoMode } from '@/lib/demo';
import { useDemoFavorites } from '@/lib/demo/use-demo-favorites';
import { venueCardMeta } from '@/lib/venue-card-meta';

export interface HomeVenueCardProps {
  venue: PublicVenueCard;
  /** Cover `sizes` of the slot the card sits in. */
  imageSizes: string;
  className?: string | undefined;
}

/**
 * A venue of the home rails: the real card data, plus the demo-only rating,
 * badge and heart (none of them exist outside the demo mode).
 */
export function HomeVenueCard({
  venue,
  imageSizes,
  className,
}: HomeVenueCardProps) {
  const favorites = useDemoFavorites();
  const extras = demoVenueExtras(venue.slug);

  return (
    <VenueCard
      href={`/espacos/${venue.slug}`}
      name={venue.name}
      imageUrl={venue.coverUrl}
      imageAlt=""
      imageSrcSet={venue.coverSrcSet}
      imageSizes={imageSizes}
      meta={venueCardMeta(venue)}
      priceCents={venue.minPriceCentsPerHour}
      priceFrom
      nextFreeTime={venue.nextFreeTime}
      rating={extras?.rating}
      badge={extras?.badge}
      square
      favorite={
        isDemoMode
          ? {
              pressed: favorites.isFavorite(venue.slug),
              onToggle: () => {
                favorites.toggle(venue.slug);
              },
            }
          : undefined
      }
      linkComponent={AppLink}
      className={className}
    />
  );
}
