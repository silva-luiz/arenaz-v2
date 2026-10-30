import {
  AVAILABILITY_HORIZON_DAYS,
  ownerAgendaSchema,
  ownerVenueSummarySchema,
  venueSchema,
} from '@arenaz/contracts';
import { cn } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AgendaView } from '@/components/owner/agenda-view';
import { OwnerIndicators } from '@/components/owner/owner-indicators';
import { apiGet } from '@/lib/api';
import { addDaysToDateKey, dateChips } from '@/lib/booking-client';
import { isDemoMode } from '@/lib/demo';
import { dashboardDateLabel, ownerGreeting } from '@/lib/owner-dashboard';
import { getSession } from '@/lib/session';
import { todayInZone } from '@/lib/zoned-time';

export const metadata: Metadata = { title: 'Agenda' };

const DAYS = 7;
/** The owner can look back a month and ahead as far as bookings go. */
const DAYS_BACK = 30;
const DAYS_AHEAD = AVAILABILITY_HORIZON_DAYS;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

// The segmented "Hoje | Amanhã | Semana" of Painel.dc.html.
const SEGMENT =
  'inline-flex h-11 shrink-0 items-center rounded-[9px] px-3.5 text-[13px] font-semibold whitespace-nowrap md:h-[34px]';

/**
 * `?data=` when it is a real date from 30 days ago to 60 days ahead (in the
 * venue's zone), otherwise today. Date keys compare as text.
 */
function pickDate(requested: string | string[] | undefined, today: string) {
  if (typeof requested !== 'string' || !DATE_KEY.test(requested)) return today;
  const first = addDaysToDateKey(today, -DAYS_BACK);
  const last = addDaysToDateKey(today, DAYS_AHEAD);
  // A date that does not exist (02-31) rolls over when normalized.
  const exists = addDaysToDateKey(requested, 0) === requested;
  return exists && requested >= first && requested <= last ? requested : today;
}

/**
 * The owner's day of one venue (Painel.dc.html "Hoje"): today's date and a
 * greeting at the venue's hour, the indicators of today, and the agenda of
 * the chosen day with its navigation (a week of days, any date from 30 days
 * back to the booking horizon).
 */
export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const here = `/painel/espacos/${id}/agenda`;
  const venueId = encodeURIComponent(id);

  const venue = await apiGet(`/owner/venues/${venueId}`, venueSchema, here);
  const today = todayInZone(venue.timezone);
  const date = pickDate(search.data, today);
  const [agenda, summary, session] = await Promise.all([
    apiGet(
      `/owner/venues/${venueId}/agenda?date=${date}`,
      ownerAgendaSchema,
      here,
    ),
    apiGet(
      `/owner/venues/${venueId}/summary?date=${today}`,
      ownerVenueSummarySchema,
      here,
    ),
    getSession(),
  ]);

  const days = dateChips(today).slice(0, DAYS);
  const base = `/painel/espacos/${venue.id}/agenda`;

  const intro = (
    <>
      <p className="text-sm text-muted">{dashboardDateLabel(today)}</p>
      <h1 className="mt-1 text-[30px] leading-tight font-[650] tracking-[-0.025em]">
        {ownerGreeting(session?.name ?? '', venue.timezone)}
      </h1>
    </>
  );

  const dayNav = (
    <div className="flex max-w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* relative: the sr-only text stays inside the scroller. */}
      <nav
        aria-label="Dia da agenda"
        className="relative max-w-full overflow-x-auto"
      >
        <ul className="flex w-max gap-0.5 rounded-xl bg-[#F2F2F2] p-1">
          {days.map((day) => {
            const current = day.date === date;
            return (
              <li key={day.date}>
                <Link
                  href={`/painel/espacos/${venue.id}/agenda?data=${day.date}`}
                  aria-current={current ? 'page' : undefined}
                  aria-label={day.ariaLabel}
                  className={cn(
                    SEGMENT,
                    FOCUS,
                    current
                      ? 'bg-bg text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {day.label}
                </Link>
              </li>
            );
          })}
          {/* A week view does not exist yet: only teased in the demo. */}
          {isDemoMode ? (
            <li>
              <button
                type="button"
                disabled
                title="Em breve"
                className={cn(SEGMENT, 'cursor-not-allowed text-muted')}
              >
                Semana <span className="sr-only">(em breve)</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
      <form
        method="get"
        action={base}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor="agenda-data" className="text-[13px] text-muted">
          Ir para a data
        </label>
        <input
          id="agenda-data"
          type="date"
          name="data"
          defaultValue={date}
          min={addDaysToDateKey(today, -DAYS_BACK)}
          max={addDaysToDateKey(today, DAYS_AHEAD)}
          required
          className={cn(
            'h-11 rounded-[9px] border border-line-control bg-bg px-2.5 text-[13px] text-ink md:h-[34px]',
            FOCUS,
          )}
        />
        <button
          type="submit"
          className={cn(
            'h-11 rounded-[9px] border border-line-strong bg-bg px-3 text-[13px] font-semibold text-ink hover:bg-surface md:h-[34px]',
            FOCUS,
          )}
        >
          Ver dia
        </button>
      </form>
    </div>
  );

  return (
    // Remounts per day: the selection, dialogs and notices never leak across
    // days.
    <AgendaView
      key={`${date}-${agenda.timezone}`}
      date={date}
      today={today}
      timezone={agenda.timezone}
      fields={agenda.fields}
      hours={venue.hours}
      intro={intro}
      indicators={<OwnerIndicators summary={summary} />}
      dayNav={dayNav}
    />
  );
}
