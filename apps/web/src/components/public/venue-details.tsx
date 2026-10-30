import {
  AMENITY_LABELS,
  CANCELLATION_POLICY_DESCRIPTIONS,
  CANCELLATION_POLICY_LABELS,
  WEEKDAY_LABELS,
  type PublicVenue,
} from '@arenaz/contracts';
import { cn, FOCUS_RING } from '@arenaz/ui';
import type { ReactNode } from 'react';
import { demoVenueExtras, isDemoMode } from '@/lib/demo';
import { formatMinute } from '@/lib/format-br';
import { AmenityIcon } from './amenity-icon';
import { CourtList, venueFacts, venueHeadline } from './court-list';
import { VenueLocation } from './venue-location';

/**
 * Brazilians read the week starting on Monday, so the hours go Seg..Dom even
 * though weekday indexes start on Sunday (0).
 */
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;

/** The section titles of Quadra.dc.html. */
export const SECTION_TITLE = 'text-[22px] font-[650] tracking-[-0.02em]';

/** The divider between the blocks of the page. */
const RULE = 'border-b border-line';

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
      className={cn(RULE, 'py-[30px] last:border-b-0')}
    >
      <h2 id={id} className={SECTION_TITLE}>
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

function Star({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.3 5.8 21 7.2 14 2 9.3 8.9 8.6" />
    </svg>
  );
}

/** Line icon of the prototype (24px, 1.6 stroke). */
function LineIcon({
  size = 24,
  strokeWidth = 1.6,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

interface Highlight {
  title: string;
  text: string;
  icon: ReactNode;
}

const INSTANT: Highlight = {
  title: 'Reserva instantânea',
  text: 'O horário é seu assim que o Pix cai. Sem esperar resposta do dono.',
  icon: (
    <LineIcon>
      <polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2" />
    </LineIcon>
  ),
};

/** Racha and mensalistas come in later plans: demo copy only. */
const DEMO_HIGHLIGHTS: Highlight[] = [
  {
    title: 'Racha no Pix',
    text: 'Você paga, o app cobra a parte de cada um e devolve pra você.',
    icon: (
      <LineIcon>
        <circle cx="9" cy="8" r="3.5" />
        <circle cx="17" cy="9.5" r="2.5" />
        <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
        <path d="M16 14.6c2.7.1 4.8 1.8 5.5 4.9" />
      </LineIcon>
    ),
  },
  {
    title: 'Aceita mensalista',
    text: 'Terças e quintas às 21h ainda têm vaga fixa.',
    icon: (
      <LineIcon>
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <line x1="3" y1="9.5" x2="21" y2="9.5" />
        <path d="M9 15l2 2 4-4" />
      </LineIcon>
    ),
  },
];

function reviewsLabel(count: number): string {
  return `${count.toLocaleString('pt-BR')} avaliações`;
}

/**
 * What the venue is, under the photos (Quadra.dc.html): the headline and the
 * real facts of the court, the host, and the highlights. The rating, the
 * "Uma das mais bem avaliadas" card, "Dono destaque" and the racha and
 * mensalista highlights are fictional: demo mode only, and nothing is left
 * in their place without it.
 */
export function VenueOverview({ venue }: { venue: PublicVenue }) {
  const extras = demoVenueExtras(venue.slug);
  const facts = venueFacts(venue);
  const highlights = isDemoMode ? [INSTANT, ...DEMO_HIGHLIGHTS] : [INSTANT];

  return (
    <div>
      <div className={cn(RULE, 'pb-[26px]')}>
        <h2 className={cn(SECTION_TITLE, 'break-words')}>
          {venueHeadline(venue)}
        </h2>
        {facts ? <p className="mt-1.5 text-base text-ink">{facts}</p> : null}
        {extras ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[15px]">
            <Star size={13} />
            <strong className="font-[650]">{extras.rating}</strong>
            {' · '}
            <a
              href="#avaliacoes"
              className={cn(
                'inline-flex items-center font-semibold text-ink underline max-md:min-h-11',
                FOCUS_RING,
              )}
            >
              {reviewsLabel(extras.reviewsCount)}
            </a>
          </p>
        ) : null}
      </div>

      {extras ? (
        <div className="az-lift my-[26px] flex flex-wrap items-center gap-5 rounded-photo border border-line px-6 py-5 shadow-1">
          <span className="flex flex-[1_1_200px] items-center gap-2.5">
            <LineIcon size={30} strokeWidth={1.5}>
              <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 16.9l.9-5.4-3.9-3.8 5.4-.8z" />
              <path d="M8 17.5L6 22l6-2 6 2-2-4.5" />
            </LineIcon>
            <span className="text-base leading-tight font-[650]">
              Uma das mais bem avaliadas da cidade
            </span>
          </span>
          {extras.praise ? (
            <span className="flex-[1_1_220px] text-sm text-muted">
              {extras.praise}
            </span>
          ) : null}
          <span className="flex items-center">
            <span className="px-2 text-center">
              <strong className="block text-xl font-bold">
                {extras.rating}
              </strong>
              <span className="text-xs text-muted">nota</span>
            </span>
            <span aria-hidden="true" className="h-9 w-px bg-line-strong" />
            <span className="px-2 text-center">
              <strong className="block text-xl font-bold">
                {extras.reviewsCount.toLocaleString('pt-BR')}
              </strong>
              <span className="text-xs text-muted">avaliações</span>
            </span>
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          RULE,
          'flex items-center gap-4 pb-[26px]',
          extras ? null : 'pt-[26px]',
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-brand font-[650] text-white"
        >
          {venue.host.firstName.charAt(0).toLocaleUpperCase('pt-BR')}
        </span>
        <span className="min-w-0">
          <strong className="block text-base font-[650] break-words">
            {`Dono: ${venue.host.firstName}`}
          </strong>
          {extras?.hostHighlight ? (
            <span className="text-sm text-muted">{extras.hostHighlight}</span>
          ) : null}
        </span>
      </div>

      <ul
        role="list"
        className={cn(RULE, 'flex flex-col gap-[22px] py-[26px]')}
      >
        {highlights.map((highlight) => (
          <li key={highlight.title} className="flex gap-[18px]">
            {highlight.icon}
            <span>
              <strong className="block text-base font-[650]">
                {highlight.title}
              </strong>
              <span className="text-sm text-muted">{highlight.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "4,92 · 318 avaliações", the sub-ratings and the reviews (Rafael, Camila):
 * all fictional, so only in the demo mode; nothing otherwise.
 */
export function VenueReviews({ slug }: { slug: string }) {
  const extras = demoVenueExtras(slug);
  if (!extras) return null;
  return (
    <section
      id="avaliacoes"
      aria-labelledby="avaliacoes-titulo"
      className={cn(RULE, 'py-[30px]')}
    >
      <h2
        id="avaliacoes-titulo"
        className={cn(SECTION_TITLE, 'mb-[22px] flex items-center gap-2')}
      >
        <Star size={18} />
        {`${extras.rating} · ${reviewsLabel(extras.reviewsCount)}`}
      </h2>
      {extras.subRatings.length > 0 ? (
        <dl className="mb-[26px] grid grid-cols-2 gap-y-4 border-b border-line pb-6 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {extras.subRatings.map((sub) => (
            <div
              key={sub.label}
              className="border-line pr-[18px] sm:border-r sm:pl-[18px] sm:first:pl-0 sm:last:border-r-0"
            >
              <dt className="text-sm font-semibold">{sub.label}</dt>
              <dd className="mt-1 text-lg font-[650]">{sub.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {extras.reviews.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-x-10 gap-y-7">
          {extras.reviews.map((review) => (
            <figure key={review.author}>
              <figcaption className="mb-2.5 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  style={{ background: review.color }}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-[650] text-white"
                >
                  {review.initials}
                </span>
                <span>
                  <strong className="block text-[15px] font-[650]">
                    {review.author}
                  </strong>
                  <span className="text-[13px] text-muted">
                    {review.context}
                  </span>
                </span>
              </figcaption>
              <blockquote className="text-[15px] leading-relaxed">
                {review.text}
              </blockquote>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The real details below the picker and the reviews: description, amenities,
 * courts, opening hours, cancellation policy and the approximate map.
 * Sections with nothing to show are left out.
 */
export function VenueDetails({ venue }: { venue: PublicVenue }) {
  return (
    <div>
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

      <Section id="funcionamento" title="Horário de funcionamento">
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
        <p className="mt-3.5 text-[15px] text-muted">
          {`${venue.neighborhood}, ${venue.city}. O endereço exato aparece depois da reserva.`}
        </p>
      </Section>
    </div>
  );
}
