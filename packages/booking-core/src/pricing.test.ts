import { describe, expect, it } from 'vitest';
import { priceSegments, type PriceRule } from './pricing.js';

const SP = 'America/Sao_Paulo';
const d = (s: string) => new Date(s);
const rule = (over: Partial<PriceRule> & { id: string }): PriceRule => ({
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  startMinute: 0,
  endMinute: 1440,
  priceCentsPerHour: 20000,
  ...over,
});

describe('priceSegments', () => {
  it('preço por segmento com faixa parcial', () => {
    // Fri 18:00-20:00 SP = 21:00Z-23:00Z. Rule Fri 19:00-23:00 at 25000/h.
    const segs = priceSegments(
      d('2026-11-06T21:00:00Z'),
      d('2026-11-06T23:00:00Z'),
      SP,
      18000,
      [
        rule({
          id: 'a',
          weekdays: [5],
          startMinute: 1140,
          endMinute: 1380,
          priceCentsPerHour: 25000,
        }),
      ],
    );
    expect(segs.map((s) => s.priceCents)).toEqual([9000, 9000, 12500, 12500]);
    expect(segs.reduce((n, s) => n + s.priceCents, 0)).toBe(43000);
    expect(segs[0]?.startsAt.toISOString()).toBe('2026-11-06T21:00:00.000Z');
    expect(segs[3]?.endsAt.toISOString()).toBe('2026-11-06T23:00:00.000Z');
  });

  it('uses base price when no rule matches, and rounds half cents up', () => {
    const segs = priceSegments(
      d('2026-11-06T21:00:00Z'),
      d('2026-11-06T21:30:00Z'),
      SP,
      18001,
      [],
    );
    expect(segs).toHaveLength(1);
    expect(segs[0]?.priceCents).toBe(9001); // round(9000.5)
  });

  it('rule end is exclusive and 1440 covers the last segment of the day', () => {
    const rules = [
      rule({
        id: 'a',
        weekdays: [5],
        startMinute: 1380,
        endMinute: 1440,
        priceCentsPerHour: 40000,
      }),
    ];
    // Fri 22:30-24:00 SP: 22:30 base, 23:00 and 23:30 rule.
    const segs = priceSegments(
      d('2026-11-07T01:30:00Z'),
      d('2026-11-07T03:00:00Z'),
      SP,
      10000,
      rules,
    );
    expect(segs.map((s) => s.priceCents)).toEqual([5000, 20000, 20000]);
  });

  it('evaluates weekday and minute per segment in the venue zone', () => {
    // Fri 23:00 -> Sat 01:00 in SP; Fri rule 22-24 at 30000, Sat rule 0-2 at 20000.
    const rules = [
      rule({
        id: 'f',
        weekdays: [5],
        startMinute: 1320,
        endMinute: 1440,
        priceCentsPerHour: 30000,
      }),
      rule({
        id: 's',
        weekdays: [6],
        startMinute: 0,
        endMinute: 120,
        priceCentsPerHour: 20000,
      }),
    ];
    const segs = priceSegments(
      d('2026-11-07T02:00:00Z'),
      d('2026-11-07T04:00:00Z'),
      SP,
      10000,
      rules,
    );
    expect(segs.map((s) => s.priceCents)).toEqual([15000, 15000, 10000, 10000]);
  });

  it('weekday differs by zone for the same instant (Noronha is 1h ahead of SP)', () => {
    const rules = [rule({ id: 's', weekdays: [6], priceCentsPerHour: 40000 })];
    // 02:30Z = Fri 23:30 SP but Sat 00:30 Noronha.
    const sp = priceSegments(
      d('2026-11-07T02:30:00Z'),
      d('2026-11-07T03:00:00Z'),
      SP,
      10000,
      rules,
    );
    const fn = priceSegments(
      d('2026-11-07T02:30:00Z'),
      d('2026-11-07T03:00:00Z'),
      'America/Noronha',
      10000,
      rules,
    );
    expect(sp[0]?.priceCents).toBe(5000);
    expect(fn[0]?.priceCents).toBe(20000);
  });

  it('Manaus and Rio Branco read the wall clock of their own zone', () => {
    const rules = [
      rule({
        id: 'n',
        startMinute: 1080,
        endMinute: 1440,
        priceCentsPerHour: 30000,
      }),
    ];
    // 22:00Z = 18:00 Manaus (rule) but 17:00 Rio Branco (base).
    const mao = priceSegments(
      d('2026-11-06T22:00:00Z'),
      d('2026-11-06T22:30:00Z'),
      'America/Manaus',
      10000,
      rules,
    );
    const rbr = priceSegments(
      d('2026-11-06T22:00:00Z'),
      d('2026-11-06T22:30:00Z'),
      'America/Rio_Branco',
      10000,
      rules,
    );
    expect(mao[0]?.priceCents).toBe(15000);
    expect(rbr[0]?.priceCents).toBe(5000);
  });

  it('desempate de faixas sobrepostas legadas: menor start, depois menor id', () => {
    const early = rule({
      id: 'z',
      startMinute: 1080,
      endMinute: 1320,
      priceCentsPerHour: 11000,
    });
    const late = rule({
      id: 'a',
      startMinute: 1140,
      endMinute: 1320,
      priceCentsPerHour: 22000,
    });
    const a = d('2026-11-06T22:30:00Z'); // Fri 19:30 SP, covered by both
    const b = d('2026-11-06T23:00:00Z');
    // Smaller start wins even with the larger id.
    expect(priceSegments(a, b, SP, 5000, [late, early])[0]?.priceCents).toBe(
      5500,
    );
    // Same start: smaller id wins, regardless of array order.
    const tieB = rule({
      id: 'b',
      startMinute: 1140,
      endMinute: 1320,
      priceCentsPerHour: 33000,
    });
    expect(priceSegments(a, b, SP, 5000, [tieB, late])[0]?.priceCents).toBe(
      11000,
    );
    expect(priceSegments(a, b, SP, 5000, [late, tieB])[0]?.priceCents).toBe(
      11000,
    );
  });

  it('does not mutate the rules array', () => {
    const rules = [
      rule({ id: 'b', startMinute: 600 }),
      rule({ id: 'a', startMinute: 0 }),
    ];
    const copy = [...rules];
    priceSegments(
      d('2026-11-06T21:00:00Z'),
      d('2026-11-06T21:30:00Z'),
      SP,
      1000,
      rules,
    );
    expect(rules).toEqual(copy);
  });

  it('rejects empty, inverted or non-30-minute ranges', () => {
    const a = d('2026-11-06T21:00:00Z');
    expect(() => priceSegments(a, a, SP, 1000, [])).toThrow(RangeError);
    expect(() =>
      priceSegments(d('2026-11-06T22:00:00Z'), a, SP, 1000, []),
    ).toThrow(RangeError);
    expect(() =>
      priceSegments(a, d('2026-11-06T21:45:00Z'), SP, 1000, []),
    ).toThrow(RangeError);
  });
});
