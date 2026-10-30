import { bookingSchema, type PublicVenue } from '@arenaz/contracts';
import { Alert, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  AddressCard,
  BookingFacts,
  CancelNote,
  CheckoutHeader,
  ConfirmedHero,
  PriceCard,
  ReviewCard,
  type CheckoutPhoto,
} from '@/components/booking/checkout-parts';
import { formatDuration } from '@/components/booking/booking-summary';
import { CancelBooking } from '@/components/booking/cancel-booking';
import { PixPayment } from '@/components/booking/pix-payment';
import { SplitOption, SquadRacha } from '@/components/booking/team-split';
import { AppLink } from '@/components/ui/next-link';
import { apiGet } from '@/lib/api';
import { whenLabel } from '@/lib/booking-client';
import {
  cancelDeadline,
  isPeakBooking,
  parsePlayersParam,
  venuePath,
} from '@/lib/checkout';
import { isDemoMode } from '@/lib/demo';
import { loadPublicVenue } from '@/lib/public-venue';
import { absoluteUrl } from '@/lib/site';
import { formatZonedRange, zonedDateKey } from '@/lib/zoned-time';

export const metadata: Metadata = { title: 'Reserva' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The venue's public data, or nothing: the photo and "nobre" are extras. */
async function venueOrNull(slug: string): Promise<PublicVenue | null> {
  try {
    return await loadPublicVenue(slug);
  } catch {
    return null;
  }
}

function coverOf(venue: PublicVenue | null): CheckoutPhoto | null {
  const first = venue?.photos.toSorted((a, b) => a.position - b.position)[0];
  return first ? { url: first.url, srcSet: first.srcSet } : null;
}

function ChooseAnother({ slug }: { slug: string }) {
  return (
    <AppLink
      href={`/espacos/${slug}`}
      className={buttonClasses({ variant: 'primary', className: 'w-full' })}
    >
      Escolher outro horário
    </AppLink>
  );
}

/** Mobile: the prototype's 390px screen; desktop: the same, up to 480px. */
function Screen({ children }: { children: ReactNode }) {
  return (
    <div data-checkout className="flex flex-1 flex-col">
      {children}
    </div>
  );
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // The API would answer 404 as well; no need to ask it about nonsense.
  if (!UUID.test(id)) notFound();
  const booking = await apiGet(
    `/bookings/${id}`,
    bookingSchema,
    `/reservas/${id}`,
  );
  // Where the venue page left the group size (the booking itself has none).
  const players = parsePlayersParam((await searchParams).jogadores);

  const now = new Date();
  const started = new Date(booking.startsAt).getTime() <= now.getTime();
  const { venue } = booking;
  const venueData =
    booking.status === 'held' || booking.status === 'confirmed'
      ? await venueOrNull(venue.slug)
      : null;
  const photo = coverOf(venueData);
  const when = whenLabel(zonedDateKey(booking.startsAt, venue.timezone));
  const range = formatZonedRange(
    booking.startsAt,
    booking.endsAt,
    venue.timezone,
  );
  const deadline = cancelDeadline(booking.startsAt, venue.timezone, now);
  // The share link stays clean; only going back keeps the group size.
  const venueHref = `/espacos/${venue.slug}`;
  const backHref = venuePath(venue.slug, players);

  if (booking.status === 'held') {
    const minutes =
      (new Date(booking.endsAt).getTime() -
        new Date(booking.startsAt).getTime()) /
      60_000;
    const base = venueData?.fields.find(
      (field) => field.id === booking.field.id,
    )?.basePriceCentsPerHour;
    const peak =
      base !== undefined &&
      isPeakBooking(booking.totalCents, booking.startsAt, booking.endsAt, base);

    return (
      <Screen>
        <CheckoutHeader backHref={backHref} title="Confirmar e pagar" />
        <div className="flex flex-col gap-3.5 px-5 pt-2.5 pb-5">
          <ReviewCard
            venueName={venue.name}
            photo={photo}
            when={when}
            range={range}
            detail={
              players === undefined
                ? booking.field.name
                : `${booking.field.name} · ${String(players)} jogadores`
            }
          />
          <PriceCard
            durationLabel={formatDuration(minutes)}
            peak={peak}
            totalCents={booking.totalCents}
          />
          {isDemoMode && players !== undefined ? (
            <SplitOption totalCents={booking.totalCents} players={players} />
          ) : null}
          <CancelNote deadline={deadline} paid={false} />
        </div>
        {booking.holdExpiresAt ? (
          <PixPayment
            bookingId={booking.id}
            holdExpiresAt={booking.holdExpiresAt}
            venueSlug={venue.slug}
            totalCents={booking.totalCents}
            serverNow={now.toISOString()}
          />
        ) : null}
        <div className="flex justify-center px-5 pb-6">
          <CancelBooking bookingId={booking.id} status="held" />
        </div>
      </Screen>
    );
  }

  if (booking.status === 'confirmed') {
    return (
      <Screen>
        <ConfirmedHero
          venueName={venue.name}
          photo={photo}
          when={when}
          range={range}
        />
        <div className="flex flex-col gap-3.5 px-5 pt-[22px]">
          <BookingFacts
            fieldName={booking.field.name}
            totalCents={booking.totalCents}
          />
          {booking.address ? (
            <AddressCard
              address={booking.address}
              neighborhood={venue.neighborhood}
              city={venue.city}
            />
          ) : null}
          {isDemoMode && players !== undefined ? (
            <SquadRacha
              players={players}
              totalCents={booking.totalCents}
              shareMessage={`Bora jogar! ${venue.name}, ${when}, ${range}. ${absoluteUrl(venueHref)}`}
            />
          ) : null}
          <CancelNote deadline={deadline} paid />
          {started ? null : (
            <div className="flex justify-center">
              <CancelBooking bookingId={booking.id} status="confirmed" />
            </div>
          )}
        </div>
        <div className="mt-auto flex gap-2.5 px-5 pt-[18px] pb-[22px]">
          <AppLink
            href="/"
            className="flex h-[52px] flex-1 items-center justify-center rounded-2xl border border-ink text-[15px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
          >
            Início
          </AppLink>
          <AppLink
            href="/reservas"
            className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-ink text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
          >
            Minhas reservas
          </AppLink>
        </div>
      </Screen>
    );
  }

  const expired = booking.status === 'expired';
  return (
    <Screen>
      <CheckoutHeader
        backHref={backHref}
        title={expired ? 'Reserva expirada' : 'Reserva cancelada'}
      />
      <div className="flex flex-col gap-3.5 px-5 pt-2.5 pb-6">
        <Alert tone="info">
          {expired
            ? 'O prazo para pagamento acabou.'
            : 'Reserva cancelada. Se havia um pagamento, o reembolso é tratado pelo suporte.'}
        </Alert>
        <ChooseAnother slug={venue.slug} />
      </div>
    </Screen>
  );
}
