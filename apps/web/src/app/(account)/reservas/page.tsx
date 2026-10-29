import type { Booking } from '@arenaz/contracts';
import { EmptyState, buttonClasses, formatPrice } from '@arenaz/ui';
import { BookingStatusBadge } from '@/components/booking/booking-status';
import { AppLink } from '@/components/ui/next-link';
import { apiGet } from '@/lib/api';
import { bookingListParser, splitBookings } from '@/lib/bookings-list';
import { formatBlockRange } from '@/lib/zoned-time';

function BookingItem({ item }: { item: Booking }) {
  return (
    <li>
      <AppLink
        href={`/reservas/${item.id}`}
        className="flex flex-col gap-2 rounded-card border border-line bg-bg p-4 transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-base font-semibold text-ink">
            {item.venue.name}
          </span>
          <BookingStatusBadge status={item.status} />
        </span>
        <span className="text-sm text-muted">
          {item.field.name} · {item.venue.neighborhood}
        </span>
        <span className="font-mono text-sm text-ink">
          {formatBlockRange(
            item.startsAt,
            item.endsAt,
            null,
            item.venue.timezone,
          )}
        </span>
        <span className="text-sm font-semibold text-ink">
          {formatPrice(item.totalCents)}
        </span>
      </AppLink>
    </li>
  );
}

function Section({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: Booking[];
}) {
  if (items.length === 0) return null;
  const headingId = `reservas-${id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <BookingItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export default async function BookingsPage() {
  const bookings = await apiGet('/bookings/me', bookingListParser, '/reservas');
  const { upcoming, past } = splitBookings(bookings, new Date());

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Minhas reservas</h1>
      {bookings.length === 0 ? (
        <EmptyState
          title="Você ainda não tem reservas."
          description="Escolha uma quadra e um horário para começar."
          action={
            <AppLink href="/buscar" className={buttonClasses({})}>
              Buscar quadras
            </AppLink>
          }
        />
      ) : (
        <>
          <Section id="proximas" title="Próximas" items={upcoming} />
          <Section id="anteriores" title="Anteriores" items={past} />
        </>
      )}
    </div>
  );
}
