import { describe, expect, it } from 'vitest';
import {
  bookingCode,
  formatNextBookingWhen,
} from '../src/booking/next-booking.js';

const SP = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';
/** São Paulo wall clock (UTC-3 all year) as an instant. */
const sp = (date: string, hhmm: string): Date =>
  new Date(`${date}T${hhmm}:00-03:00`);
/** Manaus wall clock (UTC-4 all year) as an instant. */
const manaus = (date: string, hhmm: string): Date =>
  new Date(`${date}T${hhmm}:00-04:00`);

describe('formatNextBookingWhen', () => {
  // 2026-10-30 is a Friday.
  const now = sp('2026-10-30', '15:00');

  it('says "Hoje" for a booking later today, hours without :00', () => {
    expect(
      formatNextBookingWhen(
        sp('2026-10-30', '20:00'),
        sp('2026-10-30', '22:00'),
        'Quadra 2',
        SP,
        now,
      ),
    ).toBe('Hoje · 20h às 22h · Quadra 2');
  });

  it('says "Amanhã" and keeps the minutes when they are not :00', () => {
    expect(
      formatNextBookingWhen(
        sp('2026-10-31', '19:30'),
        sp('2026-10-31', '21:00'),
        'Society A',
        SP,
        now,
      ),
    ).toBe('Amanhã · 19h30 às 21h · Society A');
  });

  it('names the weekday and the date further ahead', () => {
    expect(
      formatNextBookingWhen(
        sp('2026-11-01', '08:00'),
        sp('2026-11-01', '09:00'),
        'Quadra 1',
        SP,
        now,
      ),
    ).toBe('Dom, 1 nov · 8h às 9h · Quadra 1');
  });

  it('reads an end at midnight as 24h', () => {
    expect(
      formatNextBookingWhen(
        sp('2026-10-30', '22:00'),
        sp('2026-10-31', '00:00'),
        'Quadra 1',
        SP,
        now,
      ),
    ).toBe('Hoje · 22h às 24h · Quadra 1');
  });

  it('decides the day on the venue clock, not São Paulo', () => {
    // 00:30 in São Paulo on the 31st is still 23:30 of the 30th in Manaus.
    const late = sp('2026-10-31', '00:30');
    expect(
      formatNextBookingWhen(
        manaus('2026-10-31', '00:00'),
        manaus('2026-10-31', '01:00'),
        'Quadra 1',
        MANAUS,
        late,
      ),
    ).toBe('Amanhã · 0h às 1h · Quadra 1');
    expect(
      formatNextBookingWhen(
        manaus('2026-10-30', '23:45'),
        manaus('2026-10-31', '00:45'),
        'Quadra 1',
        MANAUS,
        late,
      ),
    ).toBe('Hoje · 23h45 às 0h45 · Quadra 1');
  });
});

describe('bookingCode', () => {
  it('is #AZ- and the first 4 characters of the id in upper case', () => {
    expect(bookingCode('3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10')).toBe(
      '#AZ-3F0C',
    );
  });
});
