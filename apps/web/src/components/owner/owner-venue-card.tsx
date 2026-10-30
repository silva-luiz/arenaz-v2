import type { VenueSummary } from '@arenaz/contracts';
import { Badge, FOCUS_RING, LogoMark, cn } from '@arenaz/ui';
import Link from 'next/link';

/*
 * Cover `sizes` for the painel grid (app/painel/page.tsx): 1 column, 2 from
 * 480px, 3 from lg, 4 from xl, 24px gaps, in the 1360px container with 16px /
 * 40px (md) gutters.
 */
const COVER_SIZES =
  '(min-width: 1360px) 302px, (min-width: 1280px) calc(25vw - 38px), (min-width: 1024px) calc(33vw - 43px), (min-width: 480px) calc(50vw - 28px), calc(100vw - 32px)';

function courtsLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'quadra' : 'quadras'}`;
}

/**
 * A venue in the owner's list, in the look of the public `VenueCard` (square
 * cover, lift and shadow on hover, photo scale) but with what the owner needs:
 * status and number of courts, and a link to the editor. The public card
 * wants sports and price, which a draft may not have yet.
 *
 * The whole card is one link; its name is the venue name and the rest is its
 * description.
 */
export function OwnerVenueCard({ venue }: { venue: VenueSummary }) {
  const nameId = `owner-venue-${venue.id}-name`;
  const detailsId = `owner-venue-${venue.id}-details`;

  return (
    <Link
      href={`/painel/espacos/${venue.id}`}
      aria-labelledby={nameId}
      aria-describedby={detailsId}
      className={cn(
        'group block rounded-photo transition-transform duration-200 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        FOCUS_RING,
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-photo bg-bg shadow-1 transition-shadow duration-200 ease-out group-hover:shadow-2 motion-reduce:transition-none">
        {venue.coverUrl ? (
          // Photos live in object storage on another origin and come with
          // their own resized variants (srcSet), so no next/image here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.coverUrl}
            {...(venue.coverSrcSet
              ? { srcSet: venue.coverSrcSet, sizes: COVER_SIZES }
              : {})}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            data-testid="owner-venue-fallback"
            className="absolute inset-0 grid place-items-center bg-bg"
          >
            <LogoMark size={56} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <span id={nameId} className="text-base font-semibold text-ink">
          {venue.name}
        </span>
        <span id={detailsId} className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{venue.city}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={venue.status === 'published' ? 'free' : 'neutral'}>
              {venue.status === 'published' ? 'Publicado' : 'Rascunho'}
            </Badge>
            <span className="text-sm text-muted">
              {courtsLabel(venue.fieldsCount)}
            </span>
          </span>
        </span>
      </div>
    </Link>
  );
}
