import { ownerAgendaSchema, venueSchema } from '@arenaz/contracts';
import { cn } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AgendaView } from '@/components/owner/agenda-view';
import { apiGet } from '@/lib/api';
import { addDaysToDateKey, dateChips } from '@/lib/booking-client';
import { todayInZone } from '@/lib/zoned-time';

export const metadata: Metadata = { title: 'Agenda' };

const DAYS = 7;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const LINK =
  'text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

/** `?data=` when it is one of the seven days offered, otherwise today. */
function pickDate(requested: string | string[] | undefined, today: string) {
  if (typeof requested !== 'string' || !DATE_KEY.test(requested)) return today;
  const offered = Array.from({ length: DAYS }, (_, index) =>
    addDaysToDateKey(today, index),
  );
  return offered.includes(requested) ? requested : today;
}

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
  const agenda = await apiGet(
    `/owner/venues/${venueId}/agenda?date=${date}`,
    ownerAgendaSchema,
    here,
  );

  const days = dateChips(today).slice(0, DAYS);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/painel/espacos/${venue.id}`} className={LINK}>
          {venue.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Agenda</h1>
      </div>

      <nav aria-label="Dia da agenda">
        <ul className="flex flex-wrap gap-2">
          {days.map((day) => {
            const current = day.date === date;
            return (
              <li key={day.date}>
                <Link
                  href={`/painel/espacos/${venue.id}/agenda?data=${day.date}`}
                  aria-current={current ? 'page' : undefined}
                  aria-label={day.ariaLabel}
                  className={cn(
                    'inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    current
                      ? 'border-brand bg-brand text-white'
                      : 'border-line-strong bg-bg text-ink hover:bg-surface',
                  )}
                >
                  {day.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Remounts per day: dialogs and notices never leak across days. */}
      <AgendaView
        key={`${date}-${agenda.timezone}`}
        date={date}
        today={today}
        timezone={agenda.timezone}
        fields={agenda.fields}
        hours={venue.hours}
      />
    </div>
  );
}
