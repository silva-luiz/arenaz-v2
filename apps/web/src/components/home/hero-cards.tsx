import { formatCents } from '@arenaz/contracts';
import { FACE_TONES } from './styles';
import type { HeroBookingShowcase, HeroRachaShowcase } from './hero-showcase';

const MAX_FACES = 5;

/** "R$ 33/cada" for whole reais, "R$ 25,50/cada" otherwise. */
export function rachaShareLabel(cents: number): string {
  const label =
    cents % 100 === 0 ? `R$ ${String(cents / 100)}` : formatCents(cents);
  return `${label}/cada`;
}

/**
 * The white "Reserva confirmada" card of the hero (Main.dc.html). `compact`
 * is the half-width card of the phone banner (MobileHome.dc.html): smaller
 * photo and text, and no booking code.
 */
export function ConfirmedBookingCard({
  booking,
  compact = false,
  className = '',
}: {
  booking: HeroBookingShowcase;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-white shadow-3 transition-transform duration-[800ms] ease-out motion-reduce:transition-none ${compact ? 'rounded-[18px] p-2' : 'rounded-[22px] p-3'} ${className}`}
    >
      <div
        className={`relative overflow-hidden ${compact ? 'h-[76px] rounded-[12px]' : 'h-[110px] rounded-[14px] lg:h-[130px] min-[68.8125rem]:h-[150px]'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
        <img
          src={booking.photoUrl}
          alt=""
          className="block size-full object-cover"
        />
        <span
          className={`az-glass absolute flex items-center rounded-full font-semibold text-ink ${compact ? 'top-1.5 left-1.5 gap-1 px-2 py-1 text-[10px]' : 'top-2.5 left-2.5 gap-1.5 px-2.5 py-[5px] text-xs'}`}
        >
          <svg
            width={compact ? 10 : 12}
            height={compact ? 10 : 12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0B7A4B"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 12 10 18 20 6" />
          </svg>
          Reserva confirmada
        </span>
      </div>
      {compact ? (
        <div className="px-1 pt-2 pb-0.5">
          <div className="truncate text-[13px] font-semibold text-ink">
            {booking.venueName}
          </div>
          <div className="truncate text-[11px] text-muted">{booking.when}</div>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2.5 px-1.5 pt-3 pb-1">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-ink">
              {booking.venueName}
            </div>
            {/* Two lines at most: a long field name must not grow the card over
                the racha card below it. */}
            <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">
              {booking.when}
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-[#F1F6F3] px-2 py-1.5 font-mono text-[13px] font-semibold text-brand">
            {booking.code}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The dark glass "Racha no Pix" card of the hero (Main.dc.html). `compact`
 * is the half-width card of the phone banner (MobileHome.dc.html).
 */
export function RachaCard({
  racha,
  compact = false,
  className = '',
}: {
  racha: HeroRachaShowcase;
  compact?: boolean;
  className?: string;
}) {
  const percent =
    racha.total > 0
      ? Math.round((Math.min(racha.paid, racha.total) / racha.total) * 100)
      : 0;
  const faces = racha.payers.slice(0, MAX_FACES);
  const others = racha.paid - faces.length;

  return (
    <div
      aria-hidden="true"
      className={`az-glass-dark border border-white/16 text-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] transition-transform duration-[800ms] ease-out motion-reduce:transition-none ${compact ? 'rounded-[18px] p-2.5' : 'rounded-[20px] p-4'} ${className}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-x-2 text-white/72 ${compact ? 'text-[11px]' : 'text-[13px]'}`}
      >
        {/* On a narrow phone the share drops to its own line, whole. */}
        <span className="whitespace-nowrap">Racha no Pix</span>
        <span className="font-mono whitespace-nowrap">
          {rachaShareLabel(racha.perPersonCents)}
        </span>
      </div>
      <div
        className={`font-semibold tracking-[-0.02em] ${compact ? 'mt-1 text-base whitespace-nowrap' : 'mt-2 text-[22px]'}`}
      >
        {`${String(racha.paid)} de ${String(racha.total)} pagaram`}
      </div>
      <div
        className={`overflow-hidden rounded-[9px] bg-white/16 ${compact ? 'mt-2.5 h-[5px]' : 'mt-3 h-1.5'}`}
      >
        <span
          data-testid="racha-progress"
          style={{ width: `${String(percent)}%` }}
          className="block h-full rounded-[9px] bg-live shadow-[0_0_12px_rgba(61,220,132,0.7)]"
        />
      </div>
      <div className={`flex items-center ${compact ? 'mt-3' : 'mt-3.5'}`}>
        {faces.map((initials, index) => (
          <span
            key={`${initials}-${String(index)}`}
            style={{ background: FACE_TONES[index % FACE_TONES.length] }}
            className={`grid place-items-center rounded-full border-2 border-night font-semibold text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] ${compact ? 'size-6 text-[9px] not-first:-ml-1.5' : 'size-7 text-[10px] not-first:-ml-2'}`}
          >
            {initials}
          </span>
        ))}
        {others > 0 ? (
          <span
            className={`text-white/72 ${compact ? 'ml-2 text-[11px]' : 'ml-2.5 text-[13px]'}`}
          >{`+${String(others)}`}</span>
        ) : null}
      </div>
    </div>
  );
}
