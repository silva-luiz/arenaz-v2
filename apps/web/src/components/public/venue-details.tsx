import {
  AMENITY_LABELS,
  CANCELLATION_POLICY_DESCRIPTIONS,
  CANCELLATION_POLICY_LABELS,
  WEEKDAY_LABELS,
  type PublicVenue,
} from '@arenaz/contracts';
import type { ReactNode } from 'react';
import { formatMinute } from '@/lib/format-br';
import { AmenityIcon } from './amenity-icon';
import { CourtList } from './court-list';
import { VenueLocation } from './venue-location';

/**
 * Brazilians read the week starting on Monday, so the hours go Seg..Dom even
 * though weekday indexes start on Sunday (0).
 */
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-b border-line py-8 last:border-b-0"
    >
      <h2 id={id} className="text-2xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** "08:00–12:00, 17:00–24:00": every interval of the day, earliest first. */
function describeIntervals(intervals: PublicVenue['hours']): string {
  return [...intervals]
    .sort((a, b) => a.openMinute - b.openMinute)
    .map(
      (hour) =>
        `${formatMinute(hour.openMinute)}–${formatMinute(hour.closeMinute)}`,
    )
    .join(', ');
}

function OpeningHours({ hours }: { hours: PublicVenue['hours'] }) {
  return (
    <dl className="max-w-md divide-y divide-line">
      {WEEK_FROM_MONDAY.map((weekday) => {
        const intervals = hours.filter((hour) => hour.weekday === weekday);
        const open = intervals.length > 0;
        return (
          <div key={weekday} className="flex justify-between gap-4 py-2.5">
            <dt>{WEEKDAY_LABELS[weekday]}</dt>
            <dd className={open ? 'text-right font-medium' : 'text-muted'}>
              {open ? describeIntervals(intervals) : 'Fechado'}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Everything below the gallery except the booking box: host, description,
 * amenities, courts, opening hours, cancellation policy and the approximate
 * map. Sections with nothing to show are left out.
 */
export function VenueDetails({ venue }: { venue: PublicVenue }) {
  const { host } = venue;

  return (
    <div>
      <div className="flex items-center gap-4 border-b border-line pb-8">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-brand font-semibold text-white"
        >
          {host.firstName.charAt(0).toLocaleUpperCase('pt-BR')}
        </span>
        <strong className="text-base font-semibold">
          {`Dono: ${host.firstName}`}
        </strong>
      </div>

      {venue.description ? (
        <Section id="sobre" title="Sobre o espaço">
          <p className="whitespace-pre-line">{venue.description}</p>
        </Section>
      ) : null}

      {venue.amenities.length > 0 ? (
        <Section id="comodidades" title="Comodidades">
          <ul
            role="list"
            className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
          >
            {venue.amenities.map((amenity) => (
              <li key={amenity} className="flex items-center gap-3.5">
                <AmenityIcon amenity={amenity} />
                {AMENITY_LABELS[amenity]}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {venue.fields.length > 0 ? (
        <Section id="quadras" title="Quadras">
          <CourtList fields={venue.fields} />
        </Section>
      ) : null}

      <Section id="horarios" title="Horário de funcionamento">
        <OpeningHours hours={venue.hours} />
      </Section>

      <Section id="cancelamento" title="Política de cancelamento">
        <p className="font-semibold">
          {CANCELLATION_POLICY_LABELS[venue.cancellationPolicy]}
        </p>
        <p className="mt-1 text-muted">
          {CANCELLATION_POLICY_DESCRIPTIONS[venue.cancellationPolicy]}
        </p>
      </Section>

      <Section id="onde-fica" title="Onde fica">
        <VenueLocation
          lat={venue.approxLocation.lat}
          lng={venue.approxLocation.lng}
        />
        <p className="mt-3.5 text-muted">
          {`${venue.neighborhood}, ${venue.city}. O endereço exato aparece depois da reserva.`}
        </p>
      </Section>
    </div>
  );
}
