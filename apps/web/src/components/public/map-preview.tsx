'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { FOCUS_RING, LogoMark, formatFreeTime, formatPrice } from '@arenaz/ui';
import { AppLink } from '@/components/ui/next-link';
import { demoVenueExtras } from '@/lib/demo';
import { venueCardMeta } from '@/lib/venue-card-meta';

export interface MapPreviewProps {
  venue: PublicVenueCard;
  /** The venue page, with the date and players of the search. */
  href: string;
  onClose: () => void;
}

/**
 * Floating card over the map for the selected venue (the prototype's
 * "selected" block): photo, name, rating (demo only), meta, and
 * "R$ 180 / hora · próximo às 20h". The whole card is the link; the close
 * button is its sibling, so it is a real button and not inside an anchor.
 */
export function MapPreview({ venue, href, onClose }: MapPreviewProps) {
  const extras = demoVenueExtras(venue.slug);

  return (
    <div className="absolute bottom-20 left-1/2 z-[1000] w-[340px] max-w-[calc(100%-2rem)] -translate-x-1/2 lg:bottom-7">
      <AppLink
        href={href}
        className={`flex flex-col overflow-hidden rounded-[22px] bg-bg shadow-3 transition-transform duration-200 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS_RING}`}
      >
        <span className="relative block h-[120px] bg-surface lg:h-[180px]">
          {venue.coverUrl ? (
            // Photos come from the storage host, not a configured Next image
            // domain (same as VenueCard in @arenaz/ui).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venue.coverUrl}
              // The card is 340px wide (less on a narrow phone).
              {...(venue.coverSrcSet
                ? { srcSet: venue.coverSrcSet, sizes: '340px' }
                : {})}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span
              data-testid="map-preview-fallback"
              className="absolute inset-0 grid place-items-center"
            >
              <LogoMark size={48} />
            </span>
          )}
        </span>
        <span className="flex flex-col gap-0.5 px-4 pt-3 pb-3.5 text-sm">
          <span className="flex items-start justify-between gap-2">
            <strong className="line-clamp-2 min-w-0 font-semibold text-ink">
              {venue.name}
            </strong>
            {extras ? (
              <span
                data-testid="map-preview-rating"
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
                <span className="sr-only">Nota</span> {extras.rating}
                <span aria-hidden="true">
                  ({extras.reviewsCount.toLocaleString('pt-BR')})
                </span>
                <span className="sr-only">
                  , {extras.reviewsCount.toLocaleString('pt-BR')} avaliações
                </span>
              </span>
            ) : null}
          </span>
          <span className="truncate text-muted">{venueCardMeta(venue)}</span>
          <span className="mt-1">
            <strong className="font-semibold text-ink">
              {formatPrice(venue.minPriceCentsPerHour)}
            </strong>{' '}
            <span className="text-muted">
              {venue.nextFreeTime
                ? `/ hora · próximo às ${formatFreeTime(venue.nextFreeTime)}`
                : '/ hora'}
            </span>
          </span>
        </span>
      </AppLink>
      <button
        type="button"
        aria-label="Fechar prévia"
        onClick={onClose}
        className="group/close absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-full outline-none"
      >
        {/* Dark disc: the X must read on a bright photo and on the bare tile. */}
        <span className="grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm group-focus-visible/close:ring-2 group-focus-visible/close:ring-ink group-focus-visible/close:ring-offset-2 group-focus-visible/close:ring-offset-white">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </span>
      </button>
    </div>
  );
}
