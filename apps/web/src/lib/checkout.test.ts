import { describe, expect, it } from 'vitest';
import {
  bookingPath,
  cancelDeadline,
  isPeakBooking,
  parsePlayersParam,
  venuePath,
  FREE_CANCEL_HOURS,
} from './checkout';

describe('parsePlayersParam', () => {
  it('accepts a whole number from 2 to 30', () => {
    expect(parsePlayersParam('14')).toBe(14);
    expect(parsePlayersParam('2')).toBe(2);
    expect(parsePlayersParam('30')).toBe(30);
  });

  it.each(['1', '31', '0', '-3', '1.5', '14x', ' 14', '', 'abc', '014'])(
    'ignores %j',
    (value) => {
      expect(parsePlayersParam(value)).toBeUndefined();
    },
  );

  it('ignores a repeated or missing parameter', () => {
    expect(parsePlayersParam(['14', '15'])).toBeUndefined();
    expect(parsePlayersParam(undefined)).toBeUndefined();
  });
});

describe('bookingPath', () => {
  it('is the booking page, with the group size when it is known', () => {
    expect(bookingPath('abc')).toBe('/reservas/abc');
    expect(bookingPath('abc', 14)).toBe('/reservas/abc?jogadores=14');
  });
});

describe('venuePath', () => {
  it('is the venue page, with the group size when it is known', () => {
    expect(venuePath('arena')).toBe('/espacos/arena');
    expect(venuePath('arena', 14)).toBe('/espacos/arena?jogadores=14');
  });
});

describe('cancelDeadline', () => {
  const SP = 'America/Sao_Paulo';

  it('is 24 hours before the start, on the wall clock of the venue', () => {
    expect(FREE_CANCEL_HOURS).toBe(24);
    // Wed 28/10 20:00 in São Paulo = 23:00Z.
    const result = cancelDeadline(
      '2026-10-28T23:00:00.000Z',
      SP,
      new Date('2026-10-26T12:00:00.000Z'),
    );
    expect(result).toEqual({ label: 'ter, 27 out, 20:00', open: true });
  });

  it('is closed once the deadline has passed (or is this very instant)', () => {
    const startsAt = '2026-10-28T23:00:00.000Z';
    expect(
      cancelDeadline(startsAt, SP, new Date('2026-10-27T23:00:00.000Z')).open,
    ).toBe(true);
    expect(
      cancelDeadline(startsAt, SP, new Date('2026-10-27T23:00:01.000Z')).open,
    ).toBe(false);
  });

  it('uses the time zone of the venue', () => {
    // 23:00Z is 19:00 in Manaus.
    expect(
      cancelDeadline(
        '2026-10-28T23:00:00.000Z',
        'America/Manaus',
        new Date('2026-10-26T00:00:00.000Z'),
      ).label,
    ).toBe('ter, 27 out, 19:00');
  });
});

describe('isPeakBooking', () => {
  const start = '2026-10-28T23:00:00.000Z';
  const end = '2026-10-29T01:00:00.000Z';

  it('is peak when the total is above the base price for the length', () => {
    expect(isPeakBooking(44000, start, end, 18000)).toBe(true);
  });

  it('is not peak at the base price, also with an odd price per hour', () => {
    expect(isPeakBooking(36000, start, end, 18000)).toBe(false);
    // Each half hour is round(18001 / 2) = 9001.
    expect(isPeakBooking(36004, start, end, 18001)).toBe(false);
  });
});
