import { describe, expect, it } from 'vitest';
import {
  localDateOf,
  localDayRange,
  localMinuteOf,
  localWeekdayOf,
  toInstant,
  weekdayOfDate,
  addDays,
} from './time.js';

const iso = (d: Date) => d.toISOString();

describe('toInstant', () => {
  it.each([
    ['America/Sao_Paulo', '2026-11-06T21:00:00.000Z'],
    ['America/Manaus', '2026-11-06T22:00:00.000Z'],
    ['America/Rio_Branco', '2026-11-06T23:00:00.000Z'],
    ['America/Noronha', '2026-11-06T20:00:00.000Z'],
  ])('18:00 local in %s', (tz, expected) => {
    expect(iso(toInstant('2026-11-06', 1080, tz))).toBe(expected);
  });

  it('Manaus: 18h local = 22:00Z', () => {
    expect(iso(toInstant('2026-11-06', 1080, 'America/Manaus'))).toBe(
      '2026-11-06T22:00:00.000Z',
    );
  });

  it('1440 is 00:00 of the next day, across month and year', () => {
    expect(iso(toInstant('2026-11-30', 1440, 'America/Sao_Paulo'))).toBe(
      '2026-12-01T03:00:00.000Z',
    );
    expect(iso(toInstant('2026-12-31', 1440, 'America/Sao_Paulo'))).toBe(
      '2027-01-01T03:00:00.000Z',
    );
    expect(iso(toInstant('2028-02-28', 1440, 'America/Manaus'))).toBe(
      '2028-02-29T04:00:00.000Z',
    );
  });

  it('historical DST: 2018-11-04 in Sao Paulo has no 00:00 (jumps to 01:00)', () => {
    // Clocks went 00:00 -> 01:00 (UTC-3 -> UTC-2): 03:00Z is 01:00 local.
    expect(iso(toInstant('2018-11-04', 0, 'America/Sao_Paulo'))).toBe(
      '2018-11-04T03:00:00.000Z',
    );
    expect(iso(toInstant('2018-11-04', 12 * 60, 'America/Sao_Paulo'))).toBe(
      '2018-11-04T14:00:00.000Z',
    );
  });

  it('historical DST: wall minute uses the offset in force at that time', () => {
    expect(iso(toInstant('2018-01-10', 18 * 60, 'America/Sao_Paulo'))).toBe(
      '2018-01-10T20:00:00.000Z',
    );
    expect(iso(toInstant('2018-07-10', 18 * 60, 'America/Sao_Paulo'))).toBe(
      '2018-07-10T21:00:00.000Z',
    );
  });
});

describe('localDayRange', () => {
  it('is [00:00, next 00:00) in the zone', () => {
    const r = localDayRange('2026-11-06', 'America/Sao_Paulo');
    expect(iso(r.start)).toBe('2026-11-06T03:00:00.000Z');
    expect(iso(r.end)).toBe('2026-11-07T03:00:00.000Z');
  });

  it('Noronha and Rio Branco days start at different instants', () => {
    expect(iso(localDayRange('2026-11-06', 'America/Noronha').start)).toBe(
      '2026-11-06T02:00:00.000Z',
    );
    expect(iso(localDayRange('2026-11-06', 'America/Rio_Branco').start)).toBe(
      '2026-11-06T05:00:00.000Z',
    );
  });

  it('has 23h on the DST start day and 25h on the DST end day (2018/2019)', () => {
    const a = localDayRange('2018-11-04', 'America/Sao_Paulo');
    expect((a.end.getTime() - a.start.getTime()) / 3_600_000).toBe(23);
    const b = localDayRange('2019-02-16', 'America/Sao_Paulo');
    expect((b.end.getTime() - b.start.getTime()) / 3_600_000).toBe(25);
  });
});

describe('localDateOf / localMinuteOf / localWeekdayOf', () => {
  it('flips the date exactly at local midnight', () => {
    const tz = 'America/Sao_Paulo';
    expect(localDateOf(new Date('2026-11-07T02:59:59.999Z'), tz)).toBe(
      '2026-11-06',
    );
    expect(localDateOf(new Date('2026-11-07T03:00:00.000Z'), tz)).toBe(
      '2026-11-07',
    );
  });

  it('the same instant is a different date in different zones', () => {
    const at = new Date('2026-11-07T01:00:00.000Z');
    expect(localDateOf(at, 'America/Sao_Paulo')).toBe('2026-11-06');
    expect(localDateOf(at, 'America/Manaus')).toBe('2026-11-06');
    expect(localDateOf(at, 'America/Rio_Branco')).toBe('2026-11-06');
    expect(localDateOf(at, 'America/Noronha')).toBe('2026-11-06');
    expect(
      localDateOf(new Date('2026-11-07T02:00:00.000Z'), 'America/Noronha'),
    ).toBe('2026-11-07');
  });

  it('minute of day and weekday follow the zone (0 = Sunday)', () => {
    const at = new Date('2026-11-07T02:30:00.000Z'); // Fri 23:30 SP, Sat 00:30 Noronha
    expect(localMinuteOf(at, 'America/Sao_Paulo')).toBe(23 * 60 + 30);
    expect(localWeekdayOf(at, 'America/Sao_Paulo')).toBe(5);
    expect(localMinuteOf(at, 'America/Noronha')).toBe(30);
    expect(localWeekdayOf(at, 'America/Noronha')).toBe(6);
    expect(
      localWeekdayOf(new Date('2026-11-08T12:00:00Z'), 'America/Manaus'),
    ).toBe(0);
  });
});

describe('date helpers', () => {
  it('rejects malformed dates', () => {
    expect(() => toInstant('2026-1-6', 0, 'America/Manaus')).toThrow(
      RangeError,
    );
    expect(() => weekdayOfDate('nope')).toThrow(RangeError);
    expect(() => addDays('', 1)).toThrow(RangeError);
  });

  it('weekdayOfDate and addDays are calendar based', () => {
    expect(weekdayOfDate('2026-11-06')).toBe(5);
    expect(weekdayOfDate('2026-11-08')).toBe(0);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('time zone guard and DST gap', () => {
  it('throws RangeError for an unknown zone', () => {
    expect(() => toInstant('2026-11-06', 0, 'Foo/Bar')).toThrow(RangeError);
    expect(() => toInstant('2026-11-06', 0, 'Foo/Bar')).toThrow(
      'invalid time zone',
    );
    expect(() => localDateOf(new Date(0), 'Foo/Bar')).toThrow(
      'invalid time zone',
    );
    expect(() => localDayRange('2026-11-06', 'Foo/Bar')).toThrow(
      'invalid time zone',
    );
  });

  it('a wall time inside a DST gap shifts forward by the gap length', () => {
    // 2018-11-04 00:30 does not exist in Sao Paulo (00:00 -> 01:00): 01:30 local.
    expect(iso(toInstant('2018-11-04', 30, 'America/Sao_Paulo'))).toBe(
      '2018-11-04T03:30:00.000Z',
    );
  });
});
