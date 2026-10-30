import type { PublicVenue } from '@arenaz/contracts';
import { Gallery } from '@arenaz/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingProvider } from '@/components/booking/booking-state';
import { SlotPicker } from '@/components/booking/slot-picker';
import { BookingCard, BookingPanel } from '@/components/public/booking-card';
import { SaveButton } from '@/components/public/save-button';
import { ShareButton } from '@/components/public/share-button';
import {
  SECTION_TITLE,
  VenueDetails,
  VenueOverview,
  VenueReviews,
} from '@/components/public/venue-details';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type BookingIntent,
} from '@/lib/booking-client';
import { isDemoMode } from '@/lib/demo';
import { venuePrice } from '@/lib/price-rule-summary';
import { loadPublicVenue } from '@/lib/public-venue';
import { absoluteUrl } from '@/lib/site';
import { isSignedIn } from '@/lib/venue-session';
import { serializeJsonLd, sortedPhotos, venueJsonLd } from '@/lib/venue-jsonld';

const DESCRIPTION_MAX_LENGTH = 160;

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SearchParams>;
}

/** The single value of a query parameter (a repeated one counts as none). */
function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
}

/** A real calendar day "YYYY-MM-DD" (2026-02-30 is not one). */
function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year = 0, month = 1, day = 1] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === text;
}

/**
 * What the home and the search hand the page: `?data` (the day to open; the
 * picker keeps it only within the bookable horizon), `?hora` ("HH:MM" on the
 * half hour, picked on that day when free) and `?jogadores` (2 to 30).
 * Anything else is ignored.
 */
function parseSearchIntent(params: SearchParams): {
  date?: string;
  time?: string;
  players?: number;
} {
  const date = single(params, 'data');
  const time = single(params, 'hora');
  const players = single(params, 'jogadores');
  const count = players && /^\d{1,2}$/.test(players) ? Number(players) : NaN;
  return {
    ...(date && isCalendarDate(date) ? { date } : {}),
    ...(time && /^([01]\d|2[0-3]):[03]0$/.test(time) ? { time } : {}),
    ...(count >= MIN_PLAYERS && count <= MAX_PLAYERS ? { players: count } : {}),
  };
}

/**
 * The choice carried through sign in (`?data=&quadra=&inicio=&duracao=`),
 * or `undefined` when any part is missing or does not make sense. Whether the
 * time is still free is decided by the picker, with fresh availability.
 */
function parseIntent(
  params: SearchParams,
  venue: PublicVenue,
): BookingIntent | undefined {
  const date = single(params, 'data');
  const fieldId = single(params, 'quadra');
  const startsAt = single(params, 'inicio');
  const duration = single(params, 'duracao');
  if (!date || !fieldId || !startsAt || !duration) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  if (!venue.fields.some((field) => field.id === fieldId)) return undefined;
  if (!ISO_WITH_OFFSET.test(startsAt) || Number.isNaN(Date.parse(startsAt))) {
    return undefined;
  }
  const durationMinutes = /^\d{2,3}$/.test(duration) ? Number(duration) : NaN;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 30 ||
    durationMinutes > 360 ||
    durationMinutes % 30 !== 0
  ) {
    return undefined;
  }
  return { date, fieldId, startsAt, durationMinutes };
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
  const venue = await loadPublicVenue(slug);

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

export default async function VenuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const venue = await loadPublicVenue(slug);
  if (!venue) notFound();
  const [signedIn, query] = await Promise.all([
    isSignedIn(),
    searchParams ?? Promise.resolve<SearchParams>({}),
  ]);
  const initial = parseIntent(query, venue);
  const arriving = parseSearchIntent(query);

  const photos = sortedPhotos(venue.photos).map((photo, index) => ({
    url: photo.url,
    srcSet: photo.srcSet,
    alt: `${venue.name}, foto ${String(index + 1)}`,
  }));
  const bookable = venue.fields.length > 0;

  return (
    // The prototype's 1160px column; the page owns its bottom gap (as the
    // home and search do).
    <div className="mx-auto max-w-[1160px] pb-12 md:pt-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            venueJsonLd(venue, absoluteUrl(`/espacos/${venue.slug}`)),
          ),
        }}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="min-w-0 text-[26px] leading-tight font-[650] tracking-[-0.025em] break-words md:text-[30px]">
          {venue.name}
        </h1>
        <div className="-ml-3 flex gap-1 md:-mr-3 md:ml-0">
          <ShareButton title={venue.name} />
          {isDemoMode ? <SaveButton slug={venue.slug} /> : null}
        </div>
      </div>

      <Gallery photos={photos} />

      <BookingProvider
        slug={venue.slug}
        timezone={venue.timezone}
        fields={venue.fields.map((field) => ({
          id: field.id,
          name: field.name,
          minSlotMinutes: field.minSlotMinutes,
          basePriceCentsPerHour: field.basePriceCentsPerHour,
        }))}
        signedIn={signedIn}
        initial={initial}
        initialDate={arriving.date}
        initialTime={arriving.time}
        initialPlayers={arriving.players}
      >
        {/* From lg: content on the left, the booking card sticky on the
            right (Quadra.dc.html: 72px apart, 340px card). Below lg the card
            is the last child and becomes a bottom bar: it must be a direct
            child here, because `sticky` only moves inside its parent. */}
        <div className="mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-[72px]">
          <div className="min-w-0">
            <VenueOverview venue={venue} />
            {bookable ? (
              <section
                id="horarios"
                aria-labelledby="horarios-titulo"
                className="border-b border-line py-[30px]"
              >
                <h2 id="horarios-titulo" className={SECTION_TITLE}>
                  Escolha o horário
                </h2>
                <div className="mt-4">
                  <SlotPicker />
                </div>
                <BookingPanel />
              </section>
            ) : null}
            <VenueReviews slug={venue.slug} />
            <VenueDetails venue={venue} />
          </div>
          <BookingCard price={venuePrice(venue.fields)} />
        </div>
      </BookingProvider>
    </div>
  );
}
