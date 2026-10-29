import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBlockRange, todayInSaoPaulo, toSaoPauloIso } from './sao-paulo';

describe('toSaoPauloIso', () => {
  it('uses -03:00 on a regular date', () => {
    expect(toSaoPauloIso('2026-10-31', 18 * 60)).toBe(
      '2026-10-31T18:00:00-03:00',
    );
    expect(toSaoPauloIso('2026-07-01', 0)).toBe('2026-07-01T00:00:00-03:00');
    expect(toSaoPauloIso('2026-07-01', 23 * 60 + 30)).toBe(
      '2026-07-01T23:30:00-03:00',
    );
  });

  it('rolls 24:00 over to 00:00 of the next day', () => {
    expect(toSaoPauloIso('2026-10-31', 24 * 60)).toBe(
      '2026-11-01T00:00:00-03:00',
    );
    expect(toSaoPauloIso('2026-12-31', 24 * 60)).toBe(
      '2027-01-01T00:00:00-03:00',
    );
    expect(toSaoPauloIso('2028-02-28', 24 * 60)).toBe(
      '2028-02-29T00:00:00-03:00',
    );
  });

  it('computes the offset of that date instead of assuming -03:00', () => {
    // Brazil still observed daylight saving time in 2018.
    expect(toSaoPauloIso('2018-11-10', 10 * 60)).toBe(
      '2018-11-10T10:00:00-02:00',
    );
    expect(toSaoPauloIso('2018-06-10', 10 * 60)).toBe(
      '2018-06-10T10:00:00-03:00',
    );
  });

  it('describes the very same instant as the wall clock in São Paulo', () => {
    const iso = toSaoPauloIso('2026-10-31', 22 * 60);
    expect(new Date(iso).toISOString()).toBe('2026-11-01T01:00:00.000Z');
  });
});

describe('toSaoPauloIso with years under 100', () => {
  it('keeps the year instead of mapping it to 19xx', () => {
    expect(toSaoPauloIso('0050-03-04', 10 * 60)).toMatch(
      /^0050-03-04T10:00:00[-+]\d{2}:\d{2}$/,
    );
    expect(toSaoPauloIso('0099-12-31', 24 * 60)).toMatch(
      /^0100-01-01T00:00:00[-+]\d{2}:\d{2}$/,
    );
  });
});

describe('todayInSaoPaulo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the date on the clock in São Paulo, not in UTC', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T01:00:00.000Z'));
    expect(todayInSaoPaulo()).toBe('2026-10-29');
    vi.setSystemTime(new Date('2026-10-30T03:00:00.000Z'));
    expect(todayInSaoPaulo()).toBe('2026-10-30');
  });
});

describe('formatBlockRange', () => {
  it('writes weekday, day/month, times and reason in São Paulo time', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        'Manutenção',
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 22:00 — Manutenção');
  });

  it('leaves the reason out when there is none', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T01:00:00.000Z',
        null,
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 22:00');
  });

  it('shows an end at midnight as 24:00', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-01T03:00:00.000Z',
        null,
      ),
    ).toBe('Sáb, 31/10 das 18:00 às 24:00');
  });

  it('names both days when the block spans more than one', () => {
    expect(
      formatBlockRange(
        '2026-10-31T21:00:00.000Z',
        '2026-11-02T11:00:00.000Z',
        'Torneio',
      ),
    ).toBe('Sáb, 31/10 18:00 até Seg, 02/11 08:00 — Torneio');
  });
});
