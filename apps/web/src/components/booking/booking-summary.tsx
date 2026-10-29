import { formatPrice } from '@arenaz/ui';

export interface SummarySelection {
  fieldName: string;
  /** "Hoje", "Sex 6" */
  dayLabel: string;
  /** "18:00–19:30" in the venue's time. */
  timeRange: string;
  totalCents: number;
}

/**
 * What the person is about to book. A polite live region, so a screen reader
 * hears the new range and total after each tap on the grid. The region is
 * always in the DOM: only text inserted into an existing region is announced.
 */
export function BookingSummary({
  selection,
}: {
  selection: SummarySelection | null;
}) {
  return (
    <div
      role="status"
      aria-label="Resumo da reserva"
      className="rounded-button bg-surface px-4 py-3"
    >
      {selection ? (
        <div className="flex items-end justify-between gap-4">
          <p className="min-w-0 text-sm text-muted">
            <span className="font-semibold text-ink">
              {selection.fieldName}
            </span>
            {' · '}
            {selection.dayLabel}
            <br />
            <span className="font-mono text-base font-semibold text-ink">
              {selection.timeRange}
            </span>
          </p>
          <p className="shrink-0 text-xl font-bold tracking-tight text-ink">
            {formatPrice(selection.totalCents)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Escolha um horário para ver o valor.
        </p>
      )}
    </div>
  );
}
