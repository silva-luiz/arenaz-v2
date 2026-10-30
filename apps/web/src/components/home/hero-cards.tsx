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

/** The white "Reserva confirmada" card of the hero (Main.dc.html). */
export function ConfirmedBookingCard({
  booking,
  className = '',
}: {
  booking: HeroBookingShowcase;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[22px] bg-white p-3 shadow-3 transition-transform duration-[800ms] ease-out motion-reduce:transition-none ${className}`}
    >
      <div className="relative h-[110px] overflow-hidden rounded-[14px] lg:h-[130px] min-[68.8125rem]:h-[150px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
        <img
          src={booking.photoUrl}
          alt=""
          className="block size-full object-cover"
        />
        <span className="az-glass absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold text-ink">
          <svg
            width="12"
            height="12"
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
      <div className="flex items-end justify-between gap-2.5 px-1.5 pt-3 pb-1">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink">
            {booking.venueName}
          </div>
          <div className="mt-0.5 text-[13px] text-muted">{booking.when}</div>
        </div>
        <div className="shrink-0 rounded-lg bg-[#F1F6F3] px-2 py-1.5 font-mono text-[13px] font-semibold text-brand">
          {booking.code}
        </div>
      </div>
    </div>
  );
}

/** The dark glass "Racha no Pix" card of the hero (Main.dc.html). */
export function RachaCard({
  racha,
  className = '',
}: {
  racha: HeroRachaShowcase;
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
      className={`az-glass-dark rounded-[20px] border border-white/16 p-4 text-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)] transition-transform duration-[800ms] ease-out motion-reduce:transition-none ${className}`}
    >
      <div className="flex items-center justify-between text-[13px] text-white/72">
        <span>Racha no Pix</span>
        <span className="font-mono">
          {rachaShareLabel(racha.perPersonCents)}
        </span>
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">
        {`${String(racha.paid)} de ${String(racha.total)} pagaram`}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-[9px] bg-white/16">
        <span
          data-testid="racha-progress"
          style={{ width: `${String(percent)}%` }}
          className="block h-full rounded-[9px] bg-live shadow-[0_0_12px_rgba(61,220,132,0.7)]"
        />
      </div>
      <div className="mt-3.5 flex items-center">
        {faces.map((initials, index) => (
          <span
            key={`${initials}-${String(index)}`}
            style={{ background: FACE_TONES[index % FACE_TONES.length] }}
            className="grid size-7 place-items-center rounded-full border-2 border-night text-[10px] font-semibold text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] not-first:-ml-2"
          >
            {initials}
          </span>
        ))}
        {others > 0 ? (
          <span className="ml-2.5 text-[13px] text-white/72">{`+${String(others)}`}</span>
        ) : null}
      </div>
    </div>
  );
}
