import { SPORT_LABELS, type Sport } from '@arenaz/contracts';
import { useId } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';
import { LogoMark } from './logo';
import { PriceTag } from './price-tag';

export interface VenueCardProps {
  href: string;
  name: string;
  neighborhood: string;
  city: string;
  /** Cover photo; without it the card shows a neutral tile with the logo. */
  coverUrl: string | null;
  sports: Sport[];
  minPriceCentsPerHour: number;
  /** Shown as "1,2 km" only when given (searches near a point). */
  distanceKm?: number | null | undefined;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

export function formatDistanceKm(km: number): string {
  return `${km.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

/**
 * The whole card is one link, so its accessible name is just the venue name
 * (`aria-labelledby`); place, sports, price and distance are its description.
 * Nothing interactive lives inside it.
 */
export function VenueCard({
  href,
  name,
  neighborhood,
  city,
  coverUrl,
  sports,
  minPriceCentsPerHour,
  distanceKm,
  linkComponent,
  className,
}: VenueCardProps) {
  const Link = linkComponent ?? 'a';
  const nameId = useId();
  const detailsId = useId();
  const hasDistance =
    distanceKm !== null &&
    distanceKm !== undefined &&
    Number.isFinite(distanceKm);

  return (
    <Link
      href={href}
      aria-labelledby={nameId}
      aria-describedby={detailsId}
      className={cn(
        'group block rounded-photo transition-transform duration-200 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        FOCUS_RING,
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-photo bg-surface shadow-1 transition-shadow duration-200 ease-out group-hover:shadow-2 motion-reduce:transition-none">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            data-testid="venue-card-fallback"
            className="absolute inset-0 grid place-items-center bg-surface"
          >
            <LogoMark size={56} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <span id={nameId} className="text-base font-semibold text-ink">
          {name}
        </span>
        <span id={detailsId} className="flex flex-col gap-0.5">
          <span className="text-sm text-muted">
            {neighborhood}, {city}
          </span>
          <span className="text-sm text-muted">
            {sports.map((sport) => SPORT_LABELS[sport]).join(' · ')}
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <PriceTag cents={minPriceCentsPerHour} from />
            {hasDistance ? (
              <span className="text-muted">{formatDistanceKm(distanceKm)}</span>
            ) : null}
          </span>
        </span>
      </div>
    </Link>
  );
}
