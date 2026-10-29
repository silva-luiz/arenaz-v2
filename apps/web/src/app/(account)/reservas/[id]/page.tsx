import { bookingSchema, type Booking } from '@arenaz/contracts';
import { Alert, Card, buttonClasses, formatPrice } from '@arenaz/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { BookingStatusBadge } from '@/components/booking/booking-status';
import { CancelBooking } from '@/components/booking/cancel-booking';
import { PixPayment } from '@/components/booking/pix-payment';
import { AppLink } from '@/components/ui/next-link';
import { apiGet } from '@/lib/api';
import { formatCep, formatPhoneBr } from '@/lib/format-br';
import { formatZonedDay, formatZonedRange } from '@/lib/zoned-time';

export const metadata: Metadata = { title: 'Reserva' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What the API enforces (see the cancellation rule of the bookings service).
const CANCEL_POLICY =
  'Cancelamento só é possível com pelo menos 24 horas de antecedência.';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function Summary({ booking }: { booking: Booking }) {
  const { venue } = booking;
  return (
    <dl className="divide-y divide-line">
      <Row label="Espaço">
        <AppLink
          href={`/espacos/${venue.slug}`}
          className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {venue.name}
        </AppLink>
        {booking.address ? null : (
          <span className="block font-normal text-muted">
            {venue.neighborhood}, {venue.city}
          </span>
        )}
      </Row>
      <Row label="Quadra">{booking.field.name}</Row>
      <Row label="Quando">
        {formatZonedDay(booking.startsAt, venue.timezone)}
        <span className="block font-mono">
          {formatZonedRange(booking.startsAt, booking.endsAt, venue.timezone)}
        </span>
      </Row>
      <Row label="Total">{formatPrice(booking.totalCents)}</Row>
    </dl>
  );
}

function ChooseAnother({ slug }: { slug: string }) {
  return (
    <AppLink
      href={`/espacos/${slug}`}
      className={buttonClasses({ variant: 'primary' })}
    >
      Escolher outro horário
    </AppLink>
  );
}

function Address({ booking }: { booking: Booking }) {
  const { address } = booking;
  if (!address) return null;
  const line = [address.street, address.number].join(', ');
  return (
    <section
      aria-labelledby="endereco"
      className="flex flex-col gap-1 rounded-button bg-surface p-4"
    >
      <h2 id="endereco" className="text-base font-semibold">
        Como chegar
      </h2>
      <p className="text-sm">
        {address.complement ? `${line} - ${address.complement}` : line}
        <br />
        {booking.venue.neighborhood}, {booking.venue.city} · CEP{' '}
        {formatCep(address.cep)}
      </p>
      <p className="text-sm">
        Telefone do espaço:{' '}
        <a
          href={`tel:${address.phone}`}
          className="font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {formatPhoneBr(address.phone)}
        </a>
      </p>
    </section>
  );
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The API would answer 404 as well; no need to ask it about nonsense.
  if (!UUID.test(id)) notFound();
  const booking = await apiGet(
    `/bookings/${id}`,
    bookingSchema,
    `/reservas/${id}`,
  );

  const now = new Date();
  const started = new Date(booking.startsAt).getTime() <= now.getTime();

  const heading =
    booking.status === 'held'
      ? 'Pague para garantir'
      : booking.status === 'confirmed'
        ? 'Quadra garantida'
        : booking.status === 'cancelled'
          ? 'Reserva cancelada'
          : 'Reserva expirada';

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <BookingStatusBadge status={booking.status} />
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
      </div>

      <Summary booking={booking} />

      {booking.status === 'held' ? (
        <>
          <p className="text-sm text-muted">{CANCEL_POLICY}</p>
          {booking.holdExpiresAt ? (
            <PixPayment
              bookingId={booking.id}
              holdExpiresAt={booking.holdExpiresAt}
              venueSlug={booking.venue.slug}
              serverNow={now.toISOString()}
            />
          ) : null}
          <CancelBooking bookingId={booking.id} status="held" />
        </>
      ) : null}

      {booking.status === 'confirmed' ? (
        <>
          <Address booking={booking} />
          <p className="text-sm text-muted">{CANCEL_POLICY}</p>
          {started ? null : (
            <CancelBooking bookingId={booking.id} status="confirmed" />
          )}
        </>
      ) : null}

      {booking.status === 'expired' ? (
        <>
          <Alert tone="info">O prazo para pagamento acabou.</Alert>
          <ChooseAnother slug={booking.venue.slug} />
        </>
      ) : null}

      {booking.status === 'cancelled' ? (
        <>
          <Alert tone="info">
            Reserva cancelada. Se havia um pagamento, o reembolso é tratado pelo
            suporte.
          </Alert>
          <ChooseAnother slug={booking.venue.slug} />
        </>
      ) : null}
    </Card>
  );
}
