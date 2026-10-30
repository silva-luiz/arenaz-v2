import type { Booking } from '@arenaz/contracts';
import { formatCents } from '@arenaz/contracts';
import { cn } from '@arenaz/ui';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/ui/next-link';
import type { CancelDeadline } from '@/lib/checkout';
import { formatCep, formatPhoneBr } from '@/lib/format-br';

/**
 * The pieces of the checkout (Checkout.dc.html, 390px phone, one column that
 * stays up to 480px on a desktop). Plain markup, no state: the page composes
 * them for each state of the booking.
 */

type BookingAddress = NonNullable<Booking['address']>;

export interface CheckoutPhoto {
  url: string;
  srcSet: string | null;
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink';

/** The 22px card of the prototype: white, 1px line, shadow 1. */
const CARD = 'rounded-[22px] border border-line bg-bg shadow-1';

/** Back arrow (a 44px target) and the title of the step. */
export function CheckoutHeader({
  backHref,
  title,
}: {
  backHref: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3.5 pb-1.5">
      <AppLink
        href={backHref}
        aria-label="Voltar"
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full text-ink',
          FOCUS,
        )}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </AppLink>
      <h1 className="font-wordmark text-[22px] font-bold tracking-[-0.02em]">
        {title}
      </h1>
    </div>
  );
}

/** Photo, venue, "Qua, 28 out · 20:00–22:00" and the court with the players. */
export function ReviewCard({
  venueName,
  photo,
  when,
  range,
  detail,
}: {
  venueName: string;
  photo: CheckoutPhoto | null;
  when: string;
  range: string;
  detail: string;
}) {
  return (
    <div className={cn(CARD, 'flex items-center gap-3.5 p-3')}>
      {photo ? (
        <span className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-[14px]">
          {/* biome-ignore lint/performance/noImgElement: venue photos are served by the API/storage, already sized */}
          <img
            src={photo.url}
            {...(photo.srcSet ? { srcSet: photo.srcSet, sizes: '88px' } : {})}
            alt=""
            loading="lazy"
            decoding="async"
            className="block size-full object-cover"
          />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-[3px]">
        <strong className="text-base font-[650]">{venueName}</strong>
        <span className="text-[13px] text-muted">
          {when} ·{' '}
          <span className="font-mono whitespace-nowrap text-ink">{range}</span>
        </span>
        <span className="text-[13px] text-muted">{detail}</span>
      </span>
    </div>
  );
}

/** The hours and the Total: the booking's real price, there is no service fee. */
export function PriceCard({
  durationLabel,
  peak,
  totalCents,
}: {
  durationLabel: string;
  peak: boolean;
  totalCents: number;
}) {
  const total = formatCents(totalCents);
  return (
    <dl className={cn(CARD, 'flex flex-col gap-2.5 p-[18px] text-[15px]')}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">
          {peak ? `${durationLabel} · horário nobre` : durationLabel}
        </dt>
        <dd>{total}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-line pt-2.5 font-[650]">
        <dt>Total</dt>
        <dd>{total}</dd>
      </div>
    </dl>
  );
}

/** What the API enforces about cancelling, with the deadline spelled out. */
export function CancelNote({
  deadline,
  paid,
}: {
  deadline: CancelDeadline;
  paid: boolean;
}) {
  const text = deadline.open
    ? `Cancelamento grátis até 24h antes (${deadline.label}).`
    : paid
      ? 'Faltam menos de 24h para o horário: esta reserva não pode mais ser cancelada.'
      : 'Esta reserva começa em menos de 24h: depois de paga, não poderá ser cancelada.';
  return <p className="text-xs leading-normal text-muted">{text}</p>;
}

/** "Quadra garantida." over the venue photo (night green without one). */
export function ConfirmedHero({
  venueName,
  photo,
  when,
  range,
}: {
  venueName: string;
  photo: CheckoutPhoto | null;
  when: string;
  range: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-b-[30px] bg-night px-6 pt-[120px] pb-[26px] text-white md:rounded-[30px]">
      {photo ? (
        // biome-ignore lint/performance/noImgElement: venue photos are served by the API/storage, already sized
        <img
          src={photo.url}
          {...(photo.srcSet
            ? { srcSet: photo.srcSet, sizes: '(min-width: 480px) 480px, 100vw' }
            : {})}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.78)_100%)]"
      />
      <span className="relative grid size-[52px] place-items-center rounded-full bg-brand">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h1 className="relative font-wordmark text-[34px] leading-none font-bold tracking-[-0.035em]">
        Quadra garantida.
      </h1>
      <p className="relative text-[15px] text-white/90">
        {venueName} · {when} ·{' '}
        <span className="font-mono whitespace-nowrap">{range}</span>
      </p>
    </div>
  );
}

/** The court and the total, what the hero does not say. */
export function BookingFacts({
  fieldName,
  totalCents,
}: {
  fieldName: string;
  totalCents: number;
}) {
  return (
    <ul
      aria-label="Sua reserva"
      className={cn(CARD, 'flex flex-col gap-2.5 p-[18px] text-[15px]')}
    >
      <Fact label="Quadra">{fieldName}</Fact>
      <Fact label="Total">{formatCents(totalCents)}</Fact>
    </ul>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-[650]">{children}</span>
    </li>
  );
}

/** Exact address and phone: only the owner of a confirmed booking gets them. */
export function AddressCard({
  address,
  neighborhood,
  city,
}: {
  address: BookingAddress;
  neighborhood: string;
  city: string;
}) {
  const line = [address.street, address.number].join(', ');
  return (
    <section
      aria-labelledby="endereco"
      className={cn(CARD, 'flex flex-col gap-1 p-[18px]')}
    >
      <h2 id="endereco" className="text-lg font-[650]">
        Como chegar
      </h2>
      <p className="text-[15px]">
        {address.complement ? `${line} - ${address.complement}` : line}
        <br />
        {neighborhood}, {city} · CEP {formatCep(address.cep)}
      </p>
      <p className="text-[15px]">
        Telefone do espaço:{' '}
        <a
          href={`tel:${address.phone}`}
          className={cn(
            'inline-flex min-h-11 items-center font-medium underline underline-offset-2',
            FOCUS,
          )}
        >
          {formatPhoneBr(address.phone)}
        </a>
      </p>
    </section>
  );
}
