import { describe, expect, it } from 'vitest';
import { localDayRange } from './time.js';
import {
  daySlots,
  openWindows,
  validateBooking,
  type HoursRow,
  type Interval,
  type ValidateBookingInput,
} from './availability.js';
import type { PriceRule } from './pricing.js';

const SP = 'America/Sao_Paulo';
const d = (s: string) => new Date(s);
const win = (w: Interval[]) =>
  w.map((i) => [i.start.toISOString(), i.end.toISOString()]);
const h = (weekday: number, open: string, close: string): HoursRow => {
  const m = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return (hh ?? 0) * 60 + (mm ?? 0);
  };
  return { weekday, openMinute: m(open), closeMinute: m(close) };
};

// 2026-11-06 is a Friday (5); 11-07 Saturday (6); 11-08 Sunday (0).
describe('openWindows', () => {
  it('returns the weekday intervals as instants, sorted', () => {
    const hours = [
      h(5, '14:00', '22:00'),
      h(5, '08:00', '12:00'),
      h(4, '08:00', '09:00'),
    ];
    expect(win(openWindows('2026-11-06', SP, hours))).toEqual([
      ['2026-11-06T11:00:00.000Z', '2026-11-06T15:00:00.000Z'],
      ['2026-11-06T17:00:00.000Z', '2026-11-07T01:00:00.000Z'],
    ]);
  });

  it('is empty on a closed day', () => {
    expect(openWindows('2026-11-06', SP, [h(4, '08:00', '09:00')])).toEqual([]);
  });

  it('merges touching and overlapping intervals of the same day', () => {
    const hours = [
      h(5, '08:00', '12:00'),
      h(5, '12:00', '18:00'),
      h(5, '17:00', '20:00'),
    ];
    expect(win(openWindows('2026-11-06', SP, hours))).toEqual([
      ['2026-11-06T11:00:00.000Z', '2026-11-06T23:00:00.000Z'],
    ]);
  });

  it('keeps a real gap between intervals', () => {
    const hours = [h(5, '08:00', '12:00'), h(5, '12:30', '18:00')];
    expect(openWindows('2026-11-06', SP, hours)).toHaveLength(2);
  });

  it('joins 24:00 with the next day 00:00 so bookings can cross midnight', () => {
    const hours = [h(5, '18:00', '24:00'), h(6, '00:00', '02:00')];
    expect(win(openWindows('2026-11-06', SP, hours))).toEqual([
      ['2026-11-06T21:00:00.000Z', '2026-11-07T05:00:00.000Z'],
    ]);
    // The next day keeps its own 00:00-02:00 window.
    expect(win(openWindows('2026-11-07', SP, hours))).toEqual([
      ['2026-11-07T03:00:00.000Z', '2026-11-07T05:00:00.000Z'],
    ]);
  });

  it('does not join when the next day opens after 00:00', () => {
    const hours = [h(5, '18:00', '24:00'), h(6, '00:30', '02:00')];
    expect(win(openWindows('2026-11-06', SP, hours))).toEqual([
      ['2026-11-06T21:00:00.000Z', '2026-11-07T03:00:00.000Z'],
    ]);
    expect(win(openWindows('2026-11-07', SP, hours))).toEqual([
      ['2026-11-07T03:30:00.000Z', '2026-11-07T05:00:00.000Z'],
    ]);
  });

  it('does not join when the day closes before 24:00', () => {
    const hours = [h(5, '18:00', '23:30'), h(6, '00:00', '02:00')];
    expect(openWindows('2026-11-06', SP, hours)).toHaveLength(1);
  });

  it('chains through a full day and wraps Saturday into Sunday', () => {
    const hours = [
      h(6, '20:00', '24:00'),
      h(0, '00:00', '24:00'),
      h(1, '00:00', '01:00'),
    ];
    expect(win(openWindows('2026-11-07', SP, hours))).toEqual([
      ['2026-11-07T23:00:00.000Z', '2026-11-09T04:00:00.000Z'],
    ]);
  });

  it('stops chaining after a week (24h venue)', () => {
    const hours = [0, 1, 2, 3, 4, 5, 6].map((w) => h(w, '00:00', '24:00'));
    const [w] = openWindows('2026-11-06', SP, hours);
    expect(w?.start.toISOString()).toBe('2026-11-06T03:00:00.000Z');
    expect(w?.end.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });

  it('ignores empty or inverted rows', () => {
    const hours = [
      h(5, '10:00', '10:00'),
      h(5, '12:00', '10:00'),
      h(5, '08:00', '09:00'),
    ];
    expect(openWindows('2026-11-06', SP, hours)).toHaveLength(1);
  });

  it.each([
    ['America/Manaus', '2026-11-06T22:00:00.000Z', '2026-11-07T02:00:00.000Z'],
    [
      'America/Rio_Branco',
      '2026-11-06T23:00:00.000Z',
      '2026-11-07T03:00:00.000Z',
    ],
    ['America/Noronha', '2026-11-06T20:00:00.000Z', '2026-11-07T00:00:00.000Z'],
  ])('uses the zone wall clock: %s', (tz, s, e) => {
    expect(
      win(openWindows('2026-11-06', tz, [h(5, '18:00', '22:00')])),
    ).toEqual([[s, e]]);
  });
});

const baseField = { minSlotMinutes: 60, basePriceCentsPerHour: 10000 };

describe('daySlots', () => {
  const now = d('2026-11-02T12:00:00Z');
  const hours = [h(5, '08:00', '10:00')];
  const args = {
    date: '2026-11-06',
    tz: SP,
    now,
    hours,
    field: baseField,
    rules: [],
    busy: [],
  };

  it('lists one item per 30-minute start, with the minimum-block end and price', () => {
    const slots = daySlots(args);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-06T11:00:00.000Z',
      '2026-11-06T11:30:00.000Z',
      '2026-11-06T12:00:00.000Z',
      '2026-11-06T12:30:00.000Z',
    ]);
    expect(slots[0]?.endsAt.toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(slots.map((s) => s.priceCents)).toEqual([
      10000, 10000, 10000, 10000,
    ]);
    // The last start cannot fit the minimum block inside opening hours.
    expect(slots.map((s) => s.available)).toEqual([true, true, true, false]);
  });

  it('slot indisponível quando o bloco mínimo cruza bloqueio, reserva ou fechamento', () => {
    const busy: Interval[] = [
      { start: d('2026-11-06T11:30:00Z'), end: d('2026-11-06T12:00:00Z') },
    ];
    const slots = daySlots({ ...args, busy });
    // 08:00 block (08-09) and 08:30 block (08:30-09:30) cross 08:30-09:00; 09:00 is clear.
    expect(slots.map((s) => s.available)).toEqual([false, false, true, false]);
  });

  it('a busy interval that only touches the block does not block it', () => {
    const busy: Interval[] = [
      { start: d('2026-11-06T10:00:00Z'), end: d('2026-11-06T11:00:00Z') },
      { start: d('2026-11-06T12:00:00Z'), end: d('2026-11-06T12:30:00Z') },
    ];
    expect(daySlots({ ...args, busy })[0]?.available).toBe(true);
  });

  it('unavailable before now, available exactly at now', () => {
    const slots = daySlots({ ...args, now: d('2026-11-06T11:30:00Z') });
    expect(slots.map((s) => s.available)).toEqual([false, true, true, false]);
  });

  it('beyond the horizon nothing is available', () => {
    const far = daySlots({ ...args, now: d('2026-08-01T12:00:00Z') });
    expect(far.every((s) => !s.available)).toBe(true);
    const edge = daySlots({
      ...args,
      now: d('2026-11-06T11:00:00Z'),
      horizonDays: 0,
    });
    expect(edge[0]?.available).toBe(true);
    expect(edge[1]?.available).toBe(true); // same local day is inside horizon 0
    const prev = daySlots({
      ...args,
      now: d('2026-11-05T15:00:00Z'),
      horizonDays: 0,
    });
    expect(prev.every((s) => !s.available)).toBe(true);
  });

  it('prices the minimum block by segment, rules included', () => {
    const rules: PriceRule[] = [
      {
        id: 'r',
        weekdays: [5],
        startMinute: 510,
        endMinute: 600,
        priceCentsPerHour: 20000,
      },
    ];
    const slots = daySlots({ ...args, rules });
    expect(slots.map((s) => s.priceCents)).toEqual([
      15000, 20000, 20000, 15000,
    ]);
  });

  it('is empty on a closed day', () => {
    expect(daySlots({ ...args, date: '2026-11-07' })).toEqual([]);
  });

  it('lists every start of a split shift but not the gap', () => {
    const split = [h(5, '08:00', '09:00'), h(5, '18:00', '19:00')];
    const slots = daySlots({
      ...args,
      hours: split,
      field: { minSlotMinutes: 30, basePriceCentsPerHour: 10000 },
    });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-06T11:00:00.000Z',
      '2026-11-06T11:30:00.000Z',
      '2026-11-06T21:00:00.000Z',
      '2026-11-06T21:30:00.000Z',
    ]);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('overnight shift: Friday lists only Friday starts, the last block crosses midnight', () => {
    const overnight = [h(5, '18:00', '24:00'), h(6, '00:00', '02:00')];
    const fri = daySlots({ ...args, hours: overnight });
    expect(fri).toHaveLength(12);
    expect(fri.at(-1)?.startsAt.toISOString()).toBe('2026-11-07T02:30:00.000Z');
    // 23:00 block 23-24 and 23:30 block 23:30-00:30 both fit thanks to the merge.
    expect(fri.at(-1)?.available).toBe(true);
    expect(fri.at(-2)?.available).toBe(true);
    const sat = daySlots({ ...args, date: '2026-11-07', hours: overnight });
    expect(sat.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-07T03:00:00.000Z',
      '2026-11-07T03:30:00.000Z',
      '2026-11-07T04:00:00.000Z',
      '2026-11-07T04:30:00.000Z',
    ]);
    expect(sat.map((s) => s.available)).toEqual([true, true, true, false]);
  });

  it('Manaus: day and slots follow the venue zone', () => {
    const slots = daySlots({
      ...args,
      tz: 'America/Manaus',
      hours: [h(5, '18:00', '19:00')],
    });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-06T22:00:00.000Z',
      '2026-11-06T22:30:00.000Z',
    ]);
  });

  it('historical DST start day has 46 half-hour starts for a 24h venue', () => {
    const slots = daySlots({
      ...args,
      date: '2018-11-04',
      now: d('2018-10-01T00:00:00Z'),
      hours: [h(0, '00:00', '24:00')],
      field: { minSlotMinutes: 30, basePriceCentsPerHour: 10000 },
    });
    expect(slots).toHaveLength(46);
    expect(slots[0]?.startsAt.toISOString()).toBe('2018-11-04T03:00:00.000Z');
  });
});

describe('validateBooking', () => {
  const now = d('2026-11-02T12:00:00Z'); // Monday
  const hours = [0, 1, 2, 3, 4, 5, 6].map((w) => h(w, '08:00', '22:00'));
  const field = { minSlotMinutes: 60, basePriceCentsPerHour: 10000 };
  const ok: ValidateBookingInput = {
    start: d('2026-11-06T21:00:00Z'), // Fri 18:00 SP
    durationMinutes: 60,
    tz: SP,
    now,
    hours,
    field,
    rules: [],
    busy: [],
  };

  it('accepts and prices a valid booking', () => {
    const rules: PriceRule[] = [
      {
        id: 'r',
        weekdays: [5],
        startMinute: 1140,
        endMinute: 1380,
        priceCentsPerHour: 25000,
      },
    ];
    const r = validateBooking({ ...ok, durationMinutes: 120, rules });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.segments).toHaveLength(4);
      expect(r.totalCents).toBe(5000 + 5000 + 12500 + 12500);
    }
  });

  it.each<[string, Partial<ValidateBookingInput>]>([
    ['past', { start: d('2026-11-01T21:00:00Z') }],
    ['misaligned', { start: d('2026-11-06T21:15:00Z') }],
    ['too_short', { durationMinutes: 30 }],
    ['closed', { start: d('2026-11-07T01:30:00Z'), durationMinutes: 60 }], // 22:30 SP
    ['too_far', { start: d('2027-02-05T21:00:00Z') }],
    [
      'busy',
      {
        busy: [
          { start: d('2026-11-06T21:30:00Z'), end: d('2026-11-06T22:30:00Z') },
        ],
      },
    ],
  ])('validateBooking → %s', (code, over) => {
    expect(validateBooking({ ...ok, ...over })).toEqual({ ok: false, code });
  });

  it('misaligned: seconds, odd durations, invalid date', () => {
    expect(
      validateBooking({ ...ok, start: d('2026-11-06T21:00:05Z') }),
    ).toEqual({ ok: false, code: 'misaligned' });
    expect(
      validateBooking({ ...ok, start: d('2026-11-06T21:00:00.500Z') }),
    ).toEqual({ ok: false, code: 'misaligned' });
    expect(validateBooking({ ...ok, durationMinutes: 75 })).toEqual({
      ok: false,
      code: 'misaligned',
    });
    expect(validateBooking({ ...ok, durationMinutes: 60.5 })).toEqual({
      ok: false,
      code: 'misaligned',
    });
    expect(validateBooking({ ...ok, start: new Date('nope') })).toEqual({
      ok: false,
      code: 'misaligned',
    });
  });

  it('too_short: zero or negative duration', () => {
    expect(validateBooking({ ...ok, durationMinutes: 0 })).toEqual({
      ok: false,
      code: 'too_short',
    });
    expect(validateBooking({ ...ok, durationMinutes: -60 })).toEqual({
      ok: false,
      code: 'too_short',
    });
  });

  it('starting exactly now is allowed; 30 minutes earlier is past', () => {
    const at = { ...ok, now: d('2026-11-06T21:00:00Z') };
    expect(validateBooking(at).ok).toBe(true);
    expect(validateBooking({ ...at, now: d('2026-11-06T21:30:00Z') })).toEqual({
      ok: false,
      code: 'past',
    });
  });

  it('horizon is 60 days by default and configurable', () => {
    const edge = d('2027-01-01T12:00:00Z'); // 09:00 SP, day +60
    expect(validateBooking({ ...ok, start: edge }).ok).toBe(true);
    expect(
      validateBooking({ ...ok, start: d('2027-01-02T12:00:00Z') }),
    ).toEqual({ ok: false, code: 'too_far' });
    expect(validateBooking({ ...ok, horizonDays: 3 })).toEqual({
      ok: false,
      code: 'too_far',
    });
  });

  it('closed: before opening, ending after closing, and on a closed day', () => {
    expect(
      validateBooking({ ...ok, start: d('2026-11-06T10:00:00Z') }),
    ).toEqual({ ok: false, code: 'closed' }); // 07:00
    expect(
      validateBooking({ ...ok, start: d('2026-11-07T00:30:00Z') }),
    ).toEqual({ ok: false, code: 'closed' }); // 21:30-22:30
    expect(validateBooking({ ...ok, hours: [h(4, '08:00', '22:00')] })).toEqual(
      { ok: false, code: 'closed' },
    );
  });

  it('can end exactly at closing time and start exactly at opening time', () => {
    expect(
      validateBooking({ ...ok, start: d('2026-11-07T00:00:00Z') }).ok,
    ).toBe(true); // 21:00-22:00
    expect(
      validateBooking({ ...ok, start: d('2026-11-06T11:00:00Z') }).ok,
    ).toBe(true); // 08:00
  });

  it('a split shift gap is closed even when both ends are open', () => {
    const split = [h(5, '08:00', '12:00'), h(5, '14:00', '22:00')];
    expect(
      validateBooking({
        ...ok,
        hours: split,
        start: d('2026-11-06T14:30:00Z'),
        durationMinutes: 120,
      }),
    ).toEqual({ ok: false, code: 'closed' }); // 11:30-13:30
  });

  it('busy ignores intervals that only touch the booking', () => {
    const busy: Interval[] = [
      { start: d('2026-11-06T20:00:00Z'), end: d('2026-11-06T21:00:00Z') },
      { start: d('2026-11-06T22:00:00Z'), end: d('2026-11-06T23:00:00Z') },
    ];
    expect(validateBooking({ ...ok, busy }).ok).toBe(true);
  });

  it('turno 18–24 + 00–02 permite reserva 23:00–01:00 e cobra pelo dia de cada segmento', () => {
    const overnight = [h(5, '18:00', '24:00'), h(6, '00:00', '02:00')];
    const rules: PriceRule[] = [
      {
        id: 'f',
        weekdays: [5],
        startMinute: 1320,
        endMinute: 1440,
        priceCentsPerHour: 30000,
      },
      {
        id: 's',
        weekdays: [6],
        startMinute: 0,
        endMinute: 120,
        priceCentsPerHour: 20000,
      },
    ];
    const r = validateBooking({
      ...ok,
      hours: overnight,
      rules,
      start: d('2026-11-07T02:00:00Z'), // Fri 23:00 SP
      durationMinutes: 120,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.totalCents).toBe(15000 + 15000 + 10000 + 10000);
    // Going past 02:00 on Saturday is closed.
    expect(
      validateBooking({
        ...ok,
        hours: overnight,
        start: d('2026-11-07T04:00:00Z'),
        durationMinutes: 90,
      }),
    ).toEqual({ ok: false, code: 'closed' });
    // A booking that starts after midnight is validated against the new day.
    expect(
      validateBooking({
        ...ok,
        hours: overnight,
        start: d('2026-11-07T03:30:00Z'),
        durationMinutes: 60,
      }).ok,
    ).toBe(true);
  });

  it('works in Manaus, Rio Branco and Noronha', () => {
    for (const tz of [
      'America/Manaus',
      'America/Rio_Branco',
      'America/Noronha',
    ]) {
      const start = d(
        tz === 'America/Manaus'
          ? '2026-11-06T22:00:00Z'
          : tz === 'America/Rio_Branco'
            ? '2026-11-06T23:00:00Z'
            : '2026-11-06T20:00:00Z',
      ); // 18:00 local in each
      expect(validateBooking({ ...ok, tz, start }).ok).toBe(true);
      expect(
        validateBooking({
          ...ok,
          tz,
          start: new Date(start.getTime() + 4 * 3_600_000 + 1_800_000),
        }),
      ).toEqual({
        ok: false,
        code: 'closed',
      });
    }
  });
});

describe('calendar-day horizon (venue zone, inclusive of day +60)', () => {
  const allDays = [0, 1, 2, 3, 4, 5, 6].map((w) => h(w, '00:00', '24:00'));
  const field = { minSlotMinutes: 30, basePriceCentsPerHour: 10000 };
  const base = {
    tz: SP,
    hours: allDays,
    field,
    rules: [] as PriceRule[],
    busy: [] as Interval[],
  };
  // now = 2026-11-02 10:00 SP; day +60 = 2027-01-01, day +61 = 2027-01-02.
  const now = d('2026-11-02T13:00:00Z');

  it('the whole of day +60 is bookable, day +61 never', () => {
    const last = validateBooking({
      ...base,
      now,
      start: d('2027-01-02T02:30:00Z'), // 2027-01-01 23:30 SP
      durationMinutes: 30,
    });
    expect(last.ok).toBe(true);
    expect(
      validateBooking({
        ...base,
        now,
        start: d('2027-01-02T03:00:00Z'), // 2027-01-02 00:00 SP
        durationMinutes: 30,
      }),
    ).toEqual({ ok: false, code: 'too_far' });
  });

  it('daySlots: last slot of day +60 available, first of day +61 not', () => {
    const d60 = daySlots({ ...base, now, date: '2027-01-01' });
    expect(d60.at(-1)?.available).toBe(true);
    expect(d60[0]?.available).toBe(true);
    const d61 = daySlots({ ...base, now, date: '2027-01-02' });
    expect(d61.every((s) => !s.available)).toBe(true);
  });

  it.each([
    ['America/Manaus', '2026-11-02T03:59:00Z', '2026-11-02T04:00:00Z'],
    ['America/Noronha', '2026-11-02T01:59:00Z', '2026-11-02T02:00:00Z'],
  ])('%s: the horizon day flips at local midnight', (tz, before, after) => {
    // before = Nov 1 23:59 local (day +60 = Dec 31); after = Nov 2 00:00 local (day +60 = Jan 1).
    const dec31End = (tzName: string) => {
      const r = localDayRange('2026-12-31', tzName);
      return new Date(r.end.getTime() - 30 * 60_000);
    };
    const jan1Start = (tzName: string) =>
      localDayRange('2027-01-01', tzName).start;
    const args = { ...base, tz, durationMinutes: 30 };
    expect(
      validateBooking({ ...args, now: d(before), start: dec31End(tz) }).ok,
    ).toBe(true);
    expect(
      validateBooking({ ...args, now: d(before), start: jan1Start(tz) }),
    ).toEqual({
      ok: false,
      code: 'too_far',
    });
    expect(
      validateBooking({ ...args, now: d(after), start: jan1Start(tz) }).ok,
    ).toBe(true);
    const slots = daySlots({ ...base, tz, now: d(before), date: '2027-01-01' });
    expect(slots.every((s) => !s.available)).toBe(true);
    const slots2 = daySlots({ ...base, tz, now: d(after), date: '2027-01-01' });
    expect(slots2.at(-1)?.available).toBe(true);
  });
});
