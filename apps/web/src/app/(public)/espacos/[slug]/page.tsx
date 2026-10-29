import {
  PUBLIC_SLUG_PATTERN,
  publicVenueSchema,
  type PublicVenue,
} from '@arenaz/contracts';
import { Gallery } from '@arenaz/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingCard } from '@/components/public/booking-card';
import { ShareButton } from '@/components/public/share-button';
import { VenueDetails } from '@/components/public/venue-details';
import { publicGet } from '@/lib/public-api';
import { lowestPriceCents } from '@/lib/price-rule-summary';
import { absoluteUrl } from '@/lib/site';
import { serializeJsonLd, sortedPhotos, venueJsonLd } from '@/lib/venue-jsonld';

// How long the Next data cache may serve the public API data (see
// `publicGet`). Not exported: the route is dynamic, so a segment-level
// `revalidate` export would do nothing.
const REVALIDATE_SECONDS = 60;

const DESCRIPTION_MAX_LENGTH = 160;

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * The venue, or `null` when it does not exist (or is not published: the API
 * answers 404 for both). A slug that can never exist skips the request.
 * Rendering the page and building its metadata both ask; Next shares the
 * identical `fetch` between them.
 */
async function loadVenue(slug: string): Promise<PublicVenue | null> {
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return null;
  return publicGet(`/venues/${encodeURIComponent(slug)}`, publicVenueSchema, {
    revalidate: REVALIDATE_SECONDS,
  });
}

/** One line of at most 160 characters, cut on a word with "…". */
function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= DESCRIPTION_MAX_LENGTH) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base =
    lastSpace > DESCRIPTION_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function pageDescription(venue: PublicVenue): string {
  return venue.description
    ? oneLine(venue.description)
    : oneLine(
        `Reserve quadras em ${venue.name}, ${venue.neighborhood}, ${venue.city}. Veja fotos, preços e horários no ArenaZ.`,
      );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadVenue(slug);

  if (!venue) {
    // The page answers 404; noindex keeps the address out of search results
    // even if a crawler keeps the response.
    return {
      title: 'Espaço não encontrado',
      robots: { index: false, follow: false },
    };
  }

  const title = `${venue.name} — ${venue.neighborhood}, ${venue.city} | ArenaZ`;
  const description = pageDescription(venue);
  const path = `/espacos/${venue.slug}`;
  const cover = sortedPhotos(venue.photos)[0];

  return {
    // `absolute`: the root template would otherwise append " · arenaz".
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'pt_BR',
      siteName: 'ArenaZ',
      url: path,
      ...(cover ? { images: [{ url: cover.url, alt: venue.name }] } : {}),
    },
  };
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const venue = await loadVenue(slug);
  if (!venue) notFound();

  const photos = sortedPhotos(venue.photos).map((photo, index) => ({
    url: photo.url,
    alt: `${venue.name}, foto ${String(index + 1)}`,
  }));
  const minPrice =
    venue.fields.length > 0
      ? Math.min(...venue.fields.map(lowestPriceCents))
      : null;

  return (
    // The page owns its bottom gap (as the home and search do).
    <div className="pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            venueJsonLd(venue, absoluteUrl(`/espacos/${venue.slug}`)),
          ),
        }}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {venue.name}
          </h1>
          <p className="mt-1 text-muted">
            {`${venue.neighborhood}, ${venue.city} · ${venue.state}`}
          </p>
        </div>
        <ShareButton title={venue.name} />
      </div>

      <Gallery photos={photos} />

      {/* From lg: content on the left, the booking card sticky on the right.
          Below lg the card is the last child and becomes a bottom bar: it must be
          a direct child here, because `sticky` only moves inside its parent. */}
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-16 xl:mt-10">
        <VenueDetails venue={venue} />
        <BookingCard minPriceCentsPerHour={minPrice} />
      </div>
    </div>
  );
}
