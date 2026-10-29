import {
  availabilitySchema,
  bookingSchema,
  type Availability,
  type Booking,
  type CreateBookingInput,
} from '@arenaz/contracts';
import { apiSend, type ApiResult } from './api-client';
import { GENERIC_ERROR, problemToFormError } from './problem';

/** Days offered by the date chips: today and the 13 after it. */
export const DATE_CHIP_COUNT = 14;

/**
 * Browser-side read of one day's availability. Public data, but never cached:
 * a time somebody just took must not look free. Never throws.
 */
export async function fetchAvailability(
  slug: string,
  date: string,
  signal?: AbortSignal,
): Promise<ApiResult<Availability>> {
  const init: RequestInit = { cache: 'no-store', credentials: 'same-origin' };
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(
      `/api/venues/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(date)}`,
      init,
    );
  } catch {
    return {
      ok: false,
      status: 0,
      fieldErrors: {},
      message: GENERIC_ERROR,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const { message, fieldErrors } = problemToFormError(body, response.status);
    return { ok: false, status: response.status, fieldErrors, message };
  }
  const parsed = availabilitySchema.safeParse(body);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        status: response.status,
        fieldErrors: {},
        message: GENERIC_ERROR,
      };
}

/** Holds the time for the signed-in player; the server prices it. */
export function createBooking(
  input: CreateBookingInput,
): Promise<ApiResult<Booking>> {
  return apiSend(
    'POST',
    '/bookings',
    {
      fieldId: input.fieldId,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
    },
    bookingSchema,
  );
}

/** What the person had chosen, to be restored after signing in. */
export interface BookingIntent {
  date: string;
  fieldId: string;
  startsAt: string;
  durationMinutes: number;
}

/** The venue page with the choice in its query string (`/entrar?next=`). */
export function bookingNextPath(slug: string, intent: BookingIntent): string {
  const query = new URLSearchParams({
    data: intent.date,
    quadra: intent.fieldId,
    inicio: intent.startsAt,
    duracao: String(intent.durationMinutes),
  });
  return `/espacos/${encodeURIComponent(slug)}?${query.toString()}`;
}

/** The sign-in page, which brings the person back to the choice. */
export function signInPathFor(slug: string, intent: BookingIntent): string {
  return `/entrar?next=${encodeURIComponent(bookingNextPath(slug, intent))}`;
}

function parseKey(dateKey: string): Date {
  const [year = 0, month = 1, day = 1] = dateKey.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** "2026-11-30" + 1 = "2026-12-01"; pure calendar arithmetic. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** "Sex 6" for a date key. */
export function shortDateLabel(dateKey: string): string {
  const date = parseKey(dateKey);
  return `${WEEKDAYS[date.getUTCDay()] ?? ''} ${String(date.getUTCDate())}`;
}

export interface DateChip {
  date: string;
  /** "Hoje", "Amanhã" or "Sex 6". */
  label: string;
}

/** Today (in the venue's zone, passed in) and the days after it. */
export function dateChips(today: string): DateChip[] {
  return Array.from({ length: DATE_CHIP_COUNT }, (_, index) => {
    const date = addDaysToDateKey(today, index);
    const label =
      index === 0 ? 'Hoje' : index === 1 ? 'Amanhã' : shortDateLabel(date);
    return { date, label };
  });
}
