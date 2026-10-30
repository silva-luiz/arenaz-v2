'use client';

import { PLAYERS_RANGE } from '@arenaz/contracts';
import { Alert, cn, FOCUS_RING, formatPrice } from '@arenaz/ui';
import { useId, useSyncExternalStore } from 'react';
import { useBooking } from '@/components/booking/booking-state';
import { BookingSummary } from '@/components/booking/booking-summary';
import { isDemoMode } from '@/lib/demo';
import type { VenuePrice } from '@/lib/price-rule-summary';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function desktopSnapshot(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DESKTOP_QUERY).matches
  );
}

/**
 * Whether the card is the wide (lg) one. The server and the first client
 * render say "no" (the bar), so hydration always matches.
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
}

/**
 * Copy of the switch: the prototype's only in the demo. Outside it nothing
 * charges each player (the racha is Plano 5), so it promises nothing.
 */
function splitCopy(): { title: string; description: string } {
  return isDemoMode
    ? {
        title: 'Dividir com o time',
        description: 'Cada um paga a sua parte no Pix',
      }
    : {
        title: 'Mostrar valor por pessoa',
        description: 'Divide o total pelo número de jogadores',
      };
}

const LABEL = 'block text-[10px] font-bold tracking-[0.04em] uppercase';

/** "Jogadores · 14 pessoas" with the − and + buttons (2 to 30). */
function PlayersRow() {
  const { players, setPlayers } = useBooking();
  const stepper = cn(
    'grid size-11 place-items-center rounded-full border border-line-control bg-bg text-lg text-ink transition-colors duration-150 hover:border-ink motion-reduce:transition-none',
    FOCUS_RING,
  );
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 pr-2 pl-3.5">
      <span>
        <span className={LABEL}>Jogadores</span>
        <span aria-live="polite" className="mt-0.5 block text-sm">
          {`${String(players)} pessoas`}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Menos um jogador"
          onClick={() => {
            setPlayers(Math.max(PLAYERS_RANGE.min, players - 1));
          }}
          className={stepper}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          aria-label="Mais um jogador"
          onClick={() => {
            setPlayers(Math.min(PLAYERS_RANGE.max, players + 1));
          }}
          className={stepper}
        >
          <span aria-hidden="true">+</span>
        </button>
      </span>
    </div>
  );
}

/**
 * "Dividir com o time": a real switch, but all it does is show each player's
 * share under the total (the racha itself is Plano 5).
 */
function SplitSwitch() {
  const { split, setSplit } = useBooking();
  const titleId = useId();
  const descriptionId = useId();
  const copy = splitCopy();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={split}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={() => {
        setSplit(!split);
      }}
      className={cn(
        'flex items-center gap-3 rounded-[12px] border border-line-strong bg-bg px-3.5 py-3 text-left text-ink',
        FOCUS_RING,
      )}
    >
      <span className="flex-1">
        <strong id={titleId} className="block text-sm font-[650]">
          {copy.title}
        </strong>
        <span id={descriptionId} className="text-[13px] text-muted">
          {copy.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors duration-150 motion-reduce:transition-none',
          split ? 'justify-end bg-brand' : 'justify-start bg-line-control',
        )}
      >
        <span className="size-5 rounded-full bg-white" />
      </span>
    </button>
  );
}

/**
 * The call to action: "Escolher horário" (takes the focus to the days) until
 * a time is chosen, then "Reservar". Busy while the booking is on its way.
 */
function BookingAction({ compact }: { compact: boolean }) {
  const { choice, reserve, submitting, focusPicker } = useBooking();
  const shape = compact
    ? 'h-11 shrink-0 rounded-button px-4 text-sm font-semibold'
    : 'h-[52px] w-full rounded-[12px] text-base font-[650]';
  const base = cn(
    'inline-flex items-center justify-center text-white transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60',
    FOCUS_RING,
    shape,
  );
  if (!choice) {
    return (
      <button
        type="button"
        onClick={focusPicker}
        className={cn(base, 'bg-ink hover:bg-black')}
      >
        Escolher horário
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={submitting}
      aria-busy={submitting ? true : undefined}
      onClick={() => {
        void reserve();
      }}
      className={cn(
        base,
        'bg-brand enabled:hover:bg-[color-mix(in_oklab,var(--color-brand)_88%,black)]',
      )}
    >
      Reservar
      {submitting ? <span className="sr-only">{', Aguarde…'}</span> : null}
    </button>
  );
}

/** "R$ 180 / hora fora de pico" ("a partir de" when it is the lowest of many). */
function PriceLine({ price, large }: { price: VenuePrice; large: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      {price.from ? (
        <span className="text-sm text-muted">a partir de</span>
      ) : null}
      <span
        className={cn('font-[650] text-ink', large ? 'text-2xl' : 'text-base')}
      >
        {formatPrice(price.cents)}
      </span>{' '}
      <span className={cn('text-muted', large ? 'text-[15px]' : 'text-sm')}>
        {price.offPeak ? '/ hora fora de pico' : '/ hora'}
      </span>
    </p>
  );
}

const NO_COURTS = 'Este espaço ainda não tem quadras para reservar.';

export interface BookingCardProps {
  /** Price of the card; `null` when the venue has no court. */
  price: VenuePrice | null;
}

/**
 * Booking box of the venue page, on the state of `BookingProvider`.
 *
 * One element, two shapes. From `lg` it is the card of the right column
 * (Quadra.dc.html), sticky below the header (84px + 24px): price, "Quando"
 * (a link to the picker), the group size, "Dividir com o time", the call to
 * action and the total. Below `lg` it is a bar that sticks to the bottom of
 * the page content, above the mobile tab bar (56px + 1px border + the device
 * safe area; from `md` there is none): the price or the chosen stretch and
 * its total, and the call to action; the rest of the card sits under the
 * picker (`BookingPanel`). It is `sticky`, not `fixed`: it is the last thing
 * in the page's flow, so when the page ends it settles above the footer and
 * never covers content. Render it as a direct child of the page's content
 * wrapper: `sticky` only moves inside its parent, and on a phone that must be
 * the whole page content.
 *
 * Focus must not hide under the bar (WCAG 2.4.11): the bar has a FIXED height,
 * the `--booking-bar-h` variable of `globals.css`, and the same variable feeds
 * the `scroll-padding-bottom` of `<html>` while a page with a `data-booking-bar`
 * element is shown (`html:has([data-booking-bar])`, below `lg`). The text may
 * wrap, but never grows the bar.
 */
export function BookingCard({ price }: BookingCardProps) {
  const desktop = useIsDesktop();
  const { fields, choice, days, date, players, split, submitError } =
    useBooking();
  const bookable = fields.length > 0;
  const when = choice
    ? `${choice.whenLabel} · ${choice.timeRange}`
    : `${days.find((day) => day.date === date)?.whenLabel ?? date} · escolha um horário`;

  return (
    <aside
      aria-label="Reserva"
      data-booking-bar=""
      className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 h-(--booking-bar-h) border-t border-line bg-bg px-4 py-2 shadow-1 md:bottom-0 md:-mx-10 md:px-10 lg:top-28 lg:bottom-auto lg:col-start-2 lg:row-start-1 lg:mx-0 lg:h-auto lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:rounded-card lg:border lg:p-[26px] lg:shadow-3"
    >
      {desktop ? (
        <div className="flex flex-col gap-4">
          {price ? <PriceLine price={price} large /> : null}
          {bookable ? (
            <>
              <div className="overflow-hidden rounded-[12px] border border-line-control">
                <a
                  href="#horarios"
                  className={cn(
                    'block border-b border-line-control px-3.5 py-2.5 text-ink no-underline hover:bg-surface',
                    FOCUS_RING,
                    'focus-visible:-outline-offset-2',
                  )}
                >
                  <span className={LABEL}>Quando</span>
                  <span className="mt-0.5 block text-sm">{when}</span>
                </a>
                <PlayersRow />
              </div>
              <SplitSwitch />
              <BookingAction compact={false} />
              <BookingSummary choice={choice} players={players} split={split} />
              <Alert tone="error">{submitError}</Alert>
            </>
          ) : (
            <p className="text-sm text-muted">{NO_COURTS}</p>
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-between gap-4">
          <div className="min-w-0">
            {choice ? (
              <>
                <p className="text-base font-[650] text-ink">
                  {formatPrice(choice.totalCents)}
                </p>
                <p className="truncate text-xs text-muted">
                  {`${choice.whenLabel} · ${choice.timeRange}`}
                </p>
              </>
            ) : price ? (
              <PriceLine price={price} large={false} />
            ) : null}
            {bookable ? null : (
              <p className="text-xs text-muted">{NO_COURTS}</p>
            )}
          </div>
          {bookable ? <BookingAction compact /> : null}
        </div>
      )}
    </aside>
  );
}

/**
 * The rest of the booking card on a phone, under the picker: the group size,
 * the switch, the total and any refusal. Nothing from `lg` up (the card has
 * them) or when the venue has no court.
 */
export function BookingPanel() {
  const desktop = useIsDesktop();
  const { fields, choice, players, split, submitError } = useBooking();
  if (desktop || fields.length === 0) return null;
  return (
    <section aria-label="Sua reserva" className="mt-6 flex flex-col gap-4">
      <div className="overflow-hidden rounded-[12px] border border-line-control">
        <PlayersRow />
      </div>
      <SplitSwitch />
      <BookingSummary choice={choice} players={players} split={split} />
      <Alert tone="error">{submitError}</Alert>
    </section>
  );
}
