import { useId } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';
import { LogoMark } from './logo';
import { PriceTag } from './price-tag';

export interface VenueCardFavorite {
  pressed: boolean;
  onToggle: () => void;
}

export interface VenueCardShowOnMap {
  /** This venue is the selected one on the map. */
  pressed: boolean;
  /** Accessible name ("Mostrar Arena Vila Madalena no mapa"). */
  label: string;
  onToggle: () => void;
}

export interface VenueCardProps {
  href: string;
  name: string;
  /** Cover photo; without it the card shows a neutral tile with the logo. */
  imageUrl: string | null;
  /** Describes the photo; pass "" when it adds nothing to the name. */
  imageAlt: string;
  /** `srcset` of the photo's resized variants; `null` while pending. */
  imageSrcSet?: string | null | undefined;
  /**
   * `sizes` of the photo for the layout the card sits in (the page knows its
   * grid). Defaults to a card of a 1/2/4-column grid.
   */
  imageSizes?: string | undefined;
  /** One line under the name ("Society · Futsal · 1,2 km"). */
  meta: string;
  priceCents: number;
  /** The price is the lowest of several: prefixes "a partir de". */
  priceFrom?: boolean | undefined;
  /** "HH:MM" of the next free slot today; the "Livre às 20h" seal needs it. */
  nextFreeTime?: string | null | undefined;
  /** Already formatted ("4,92"); shown next to the name only when given. */
  rating?: string | undefined;
  /** Glass pill on the photo ("Preferido da galera"). */
  badge?: string | undefined;
  /** Square photo (home rails) instead of the 20:19 one (search grid). */
  square?: boolean | undefined;
  /** The heart; absent means the card has no button at all. */
  favorite?: VenueCardFavorite | undefined;
  /**
   * The search results' pin button, in the heart's corner (it takes its
   * place): selects the venue on the map, and rings the photo while it is.
   */
  showOnMap?: VenueCardShowOnMap | undefined;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

/** 1.2 -> "1,2 km" (for the `meta` line of a search near a point). */
export function formatDistanceKm(km: number): string {
  return `${km.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

/** "20:00" -> "20h", "19:30" -> "19h30" (the prototype's seal). */
export function formatFreeTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const [, hh = '', mm = ''] = match;
  const hours = String(Number(hh));
  return mm === '00' ? `${hours}h` : `${hours}h${mm}`;
}

const DEFAULT_IMAGE_SIZES =
  '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw';

// White gap, then ink ring, then the card shadow: the prototype's selected card.
const SELECTED_RING =
  'shadow-[0_0_0_3px_#fff,0_0_0_5px_#161616,0_2px_6px_rgba(8,36,24,0.1),0_26px_48px_-20px_rgba(8,36,24,0.48)]';

const CORNER_BUTTON =
  'absolute top-1.5 right-1.5 grid size-11 cursor-pointer place-items-center rounded-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] focus-visible:bg-black/35 focus-visible:outline-2 focus-visible:outline-white';

const PILL =
  'az-glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)]';

/**
 * The card is one link (its accessible name is the venue name, via
 * `aria-labelledby`; seal, rating, meta and price are its description). The
 * heart is a sibling of the link, not inside it, laid over the photo.
 */
export function VenueCard({
  href,
  name,
  imageUrl,
  imageAlt,
  imageSrcSet,
  imageSizes = DEFAULT_IMAGE_SIZES,
  meta,
  priceCents,
  priceFrom = false,
  nextFreeTime,
  rating,
  badge,
  square = false,
  favorite,
  showOnMap,
  linkComponent,
  className,
}: VenueCardProps) {
  const Link = linkComponent ?? 'a';
  const nameId = useId();
  const sealId = useId();
  const ratingId = useId();
  const detailsId = useId();
  const hasSeal = nextFreeTime !== null && nextFreeTime !== undefined;
  const describedBy = [
    hasSeal ? sealId : null,
    rating ? ratingId : null,
    detailsId,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cn(
        'group relative transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <Link
        href={href}
        aria-labelledby={nameId}
        aria-describedby={describedBy}
        className={cn('block rounded-photo', FOCUS_RING)}
      >
        <div
          data-testid="venue-card-photo"
          className={cn(
            'relative overflow-hidden rounded-photo bg-surface transition-shadow duration-300 ease-out motion-reduce:transition-none',
            showOnMap?.pressed
              ? SELECTED_RING
              : 'shadow-1 group-hover:shadow-2',
            square ? 'aspect-square' : 'aspect-[20/19]',
          )}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              {...(imageSrcSet
                ? { srcSet: imageSrcSet, sizes: imageSizes }
                : {})}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div
              data-testid="venue-card-fallback"
              className="absolute inset-0 grid place-items-center bg-surface"
            >
              <LogoMark size={56} />
            </div>
          )}
          {imageUrl ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-photo bg-[linear-gradient(to_top,rgba(0,0,0,0.34),rgba(0,0,0,0)_38%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            />
          ) : null}

          {hasSeal || badge ? (
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {hasSeal ? (
                <span id={sealId} className={PILL}>
                  <span
                    data-testid="venue-card-free-dot"
                    aria-hidden="true"
                    className="size-[7px] rounded-full bg-free shadow-[0_0_0_3px_rgba(18,161,80,0.2)]"
                  />
                  Livre às {formatFreeTime(nextFreeTime)}
                </span>
              ) : null}
              {badge ? (
                <span data-testid="venue-card-badge" className={PILL}>
                  {badge}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-0.5 px-0.5 text-sm">
          <span className="flex items-start justify-between gap-2">
            <span
              id={nameId}
              className="line-clamp-2 min-w-0 font-semibold text-ink"
            >
              {name}
            </span>
            {rating ? (
              <span
                id={ratingId}
                data-testid="venue-card-rating"
                className="flex shrink-0 items-center gap-1 text-ink"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.3 5.8 21 7.2 14 2 9.3 8.9 8.6" />
                </svg>
                <span className="sr-only">Nota</span> {rating}
              </span>
            ) : null}
          </span>
          <span id={detailsId} className="flex flex-col gap-0.5">
            <span className="truncate text-muted">{meta}</span>
            <PriceTag cents={priceCents} from={priceFrom} className="mt-0.5" />
          </span>
        </div>
      </Link>

      {showOnMap ? (
        <button
          type="button"
          aria-pressed={showOnMap.pressed}
          aria-label={showOnMap.label}
          onClick={showOnMap.onToggle}
          className={CORNER_BUTTON}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={showOnMap.pressed ? 'fill-brand' : 'fill-black/45'}
          >
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" fill="#FFFFFF" />
          </svg>
        </button>
      ) : favorite ? (
        <button
          type="button"
          aria-pressed={favorite.pressed}
          aria-label={
            favorite.pressed ? 'Remover dos favoritos' : 'Salvar nos favoritos'
          }
          onClick={favorite.onToggle}
          className={CORNER_BUTTON}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden="true"
            className={favorite.pressed ? 'fill-fav' : 'fill-black/45'}
          >
            <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 2.9 1.4-1.8 2.9-2.9 5-2.9 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
