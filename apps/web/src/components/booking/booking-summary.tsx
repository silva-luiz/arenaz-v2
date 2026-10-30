import { formatCents } from '@arenaz/contracts';
import { perPersonCents } from '@/lib/booking-client';
import type { ChoiceSummary } from './booking-state';

/** "1 hora", "2 horas", "1h30", "30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  if (rest === 0) return `${String(hours)} ${hours === 1 ? 'hora' : 'horas'}`;
  return `${String(hours)}h${String(rest).padStart(2, '0')}`;
}

/**
 * The money part of the booking card (Quadra.dc.html): the hours, the total
 * (the real price of the booking: there is no service fee) and, while the
 * switch is on, each player's share, rounded up to the cent. A polite live
 * region, so a screen reader hears the new range and total after each tap on
 * the grid; it is always in the DOM (only text inserted into an existing
 * region is announced) and empty until a time is chosen.
 */
export function BookingSummary({
  choice,
  players,
  split,
}: {
  choice: ChoiceSummary | null;
  players: number;
  split: boolean;
}) {
  return (
    <div
      role="status"
      aria-label="Resumo da reserva"
      // Empty, it is visually hidden and out of the flow (no gap in the card)
      // but still in the accessibility tree.
      className={choice ? 'flex flex-col gap-2.5 text-[15px]' : 'sr-only'}
    >
      {choice ? (
        <>
          <p className="text-center text-[13px] text-muted">
            Confirmação na hora do pagamento
          </p>
          <p className="sr-only">
            {`${choice.fieldName}, ${choice.whenLabel}, ${choice.timeRange}.`}
          </p>
          <p className="flex justify-between gap-4">
            <span className="underline underline-offset-[3px]">
              {formatDuration(choice.durationMinutes)}
            </span>
            <span>{formatCents(choice.totalCents)}</span>
          </p>
          <p className="flex justify-between gap-4 border-t border-line-strong pt-3.5 font-[650]">
            <span>Total</span>
            <span>{formatCents(choice.totalCents)}</span>
          </p>
          {split ? (
            <p className="flex items-center justify-between gap-4 rounded-[12px] bg-brand-soft px-3.5 py-3 font-[650] text-brand-deep">
              <span>{`Por pessoa (${String(players)})`}</span>
              <span className="text-lg">
                {formatCents(perPersonCents(choice.totalCents, players))}
              </span>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
