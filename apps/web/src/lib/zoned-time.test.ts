import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatBlockRange,
  formatZonedDay,
  formatZonedRange,
  formatZonedTime,
  todayInZone,
  toZonedIso,
} from './zoned-time';

const SP = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';

describe('toZonedIso (São Paulo)', () => {
  it('uses -03:00 on a regular date', () => {
    expect(toZonedIso('2026-10-31', 18 * 60, SP)).toBe(
      '2026-10-31T18:00:00-03:00',
    );
    expect(toZonedIso('2026-07-01', 0, SP)).toBe('2026-07-01T00:00:00-03:00');
    expect(toZonedIso('2026-07-01', 23 * 60 + 30, SP)).toBe(
      '2026-07-01T23:30:00-03:00',
    );
  });

  it('rolls 24:00 over to 00:00 of the next day', () => {
    expect(toZonedIso('2026-10-31', 24 * 60, SP)).toBe(
      '2026-11-01T00:00:00-03:00',
    );
    expect(toZonedIso('2026-12-31', 24 * 60, SP)).toBe(
      '2027-01-01T00:00:00-03:00',
    );
    expect(toZonedIso('2028-02-28', 24 * 60, SP)).toBe(
      '2028-02-29T00:00:00-03:00',
    );
  });

  it('computes the offset of that date instead of assuming -03:00', () => {
    // Brazil still observed daylight saving time in 2018.
    expect(toZonedIso('2018-11-10', 10 * 60, SP)).toBe(
      '2018-11-10T10:00:00-02:00',
    );
    expect(toZonedIso('2018-06-10', 10 * 60, SP)).toBe(
      '2018-06-10T10:00:00-03:00',
    );
  });

  it('describes the very same instant as the wall clock in São Paulo', () => {
    const iso = toZonedIso('2026-10-31', 22 * 60, SP);
    expect(new Date(iso).toISOString()).toBe('2026-11-01T01:00:00.000Z');
  });
});

describe('toZonedIso (São Paulo) with years under 100', () => {
  it('keeps the year instead of mapping it to 19xx', () => {
    expect(toZonedIso('0050-03-04', 10 * 60, SP)).toMatch(
      /^0050-03-04T10:00:00[-+]\d{2}:\d{2}$/,
    );
    expect(toZonedIso('0099-12-31', 24 * 60, SP)).toMatch(
      /^0100-01-01T00:00:00[-+]\d{2}:\d{2}$/,
    );
  });
});

describe('todayInZone', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the date on the clock in São Paulo, not in UTC', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T01:00:00.000Z'));
    expect(todayInZone(SP)).toBe('2026-10-29');
    vi.setSystemTime(new Date('2026-10-30T03:00:00.000Z'));
    expect(todayInZone(SP)).toBe('2026-10-30');
  });
});

describe('formatBlockRange', () => {
  it('writes weekday, day/month, times and reason in São Paulo time', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        'Manutenção',
        SP,
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 22:00 — Manutenção');
  });

  it('leaves the reason out when there is none', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        null,
        SP,
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 22:00');
  });

  it('shows an end at midnight as 24:00', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T03:00:00.000Z',
        null,
        SP,
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 24:00');
  });

  it('names both days when the block spans more than one', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-02T11:00:00.000Z',
        'Torneio',
        SP,
      ),
    ).toBe('Sáb, 31/10 18:00 até Seg, 02/11 08:00 — Torneio');
  });
});

describe('other time zones', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('toZonedIso uses the offset of the given zone', () => {
    expect(toZonedIso('2026-10-31', 18 * 60, MANAUS)).toBe(
      '2026-10-31T18:00:00-04:00',
    );
    expect(toZonedIso('2026-10-31', 24 * 60, MANAUS)).toBe(
      '2026-11-01T00:00:00-04:00',
    );
    expect(toZonedIso('2026-10-31', 18 * 60, 'America/Rio_Branco')).toBe(
      '2026-10-31T18:00:00-05:00',
    );
    expect(toZonedIso('2026-10-31', 18 * 60, 'America/Noronha')).toBe(
      '2026-10-31T18:00:00-02:00',
    );
    expect(
      new Date(toZonedIso('2026-10-31', 22 * 60, MANAUS)).toISOString(),
    ).toBe('2026-11-01T02:00:00.000Z');
  });

  it('todayInZone follows the zone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 03:30 UTC: already the 30th in São Paulo (-03), still the 29th in Manaus (-04).
    vi.setSystemTime(new Date('2026-10-30T03:30:00.000Z'));
    expect(todayInZone(SP)).toBe('2026-10-30');
    expect(todayInZone(MANAUS)).toBe('2026-10-29');
  });

  it('formatBlockRange writes the wall clock of the given zone', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        'Manutenção',
        MANAUS,
      ),
    ).toBe('Sáb, 31/10 das 17:00 às 21:00 — Manutenção');
    // Midnight in Manaus is 04:00 UTC.
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T04:00:00.000Z',
        null,
        MANAUS,
      ),
    ).toBe('Sáb, 31/10 das 17:00 às 24:00');
  });
});

describe('formatZonedTime and formatZonedRange', () => {
  it('reads the instant in the zone given, not in the browser zone', () => {
    expect(formatZonedTime('2026-11-06T21:00:00.000Z', SP)).toBe('18:00');
    expect(formatZonedTime('2026-11-06T21:00:00.000Z', MANAUS)).toBe('17:00');
    expect(formatZonedTime('2026-11-06T21:30:00-03:00', SP)).toBe('21:30');
  });

  it('writes a range with an en dash', () => {
    expect(
      formatZonedRange(
        '2026-11-06T18:00:00-03:00',
        '2026-11-06T19:30:00-03:00',
        SP,
      ),
    ).toBe('18:00–19:30');
  });

  it('writes an end at midnight as 24:00', () => {
    expect(
      formatZonedRange(
        '2026-11-06T23:00:00-03:00',
        '2026-11-07T00:00:00-03:00',
        SP,
      ),
    ).toBe('23:00–24:00');
  });
});

describe('formatZonedDay', () => {
  it('names the weekday and the date on the wall clock of the zone', () => {
    // 01:00Z is still the evening before in São Paulo.
    expect(
      formatZonedDay('2026-11-03T01:00:00.000Z', 'America/Sao_Paulo'),
    ).toBe('Seg, 02/11');
    expect(formatZonedDay('2026-11-03T01:00:00.000Z', 'America/Manaus')).toBe(
      'Seg, 02/11',
    );
    expect(
      formatZonedDay('2026-11-03T05:00:00.000Z', 'America/Sao_Paulo'),
    ).toBe('Ter, 03/11');
  });
});
