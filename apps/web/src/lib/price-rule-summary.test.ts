import { describe, expect, it } from 'vitest';
import {
  formatClock,
  lowestPriceCents,
  summarizePriceRule,
} from './price-rule-summary';

function rule(
  weekdays: number[],
  startMinute = 1080,
  endMinute = 1380,
  priceCentsPerHour = 25000,
) {
  return { weekdays, startMinute, endMinute, priceCentsPerHour, label: null };
}

describe('formatClock', () => {
  it('writes HH:MM like the opening hours', () => {
    expect(formatClock(1080)).toBe('18:00');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(540)).toBe('09:00');
  });

  it('pads the minutes to two digits', () => {
    expect(formatClock(1110)).toBe('18:30');
    expect(formatClock(545)).toBe('09:05');
  });

  it('writes the end of the day as 24:00', () => {
    expect(formatClock(1440)).toBe('24:00');
  });
});

describe('summarizePriceRule', () => {
  it('joins two days with "e" and writes the range and price', () => {
    expect(summarizePriceRule(rule([5, 6]))).toBe(
      'Sex e Sáb, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('collapses three or more consecutive days into "a"', () => {
    expect(summarizePriceRule(rule([1, 2, 3, 4, 5]))).toBe(
      'Seg a Sex, 18:00–23:00: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([1, 2, 3]))).toBe(
      'Seg a Qua, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('lists non-consecutive days with commas and a final "e"', () => {
    expect(summarizePriceRule(rule([1, 3, 5]))).toBe(
      'Seg, Qua e Sex, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('mixes a run with the days around it', () => {
    expect(summarizePriceRule(rule([1, 2, 3, 5]))).toBe(
      'Seg a Qua e Sex, 18:00–23:00: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([1, 2, 4, 5]))).toBe(
      'Seg, Ter, Qui e Sex, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('writes a single day as is', () => {
    expect(summarizePriceRule(rule([6]))).toBe(
      'Sáb, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('orders the days with the week starting on Monday, however they arrive', () => {
    expect(summarizePriceRule(rule([0, 6]))).toBe(
      'Sáb e Dom, 18:00–23:00: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([5, 4, 3]))).toBe(
      'Qua a Sex, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('treats Sunday after Saturday as consecutive', () => {
    expect(summarizePriceRule(rule([0, 5, 6]))).toBe(
      'Sex a Dom, 18:00–23:00: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([0, 1, 2]))).toBe(
      'Seg, Ter e Dom, 18:00–23:00: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([6, 0, 1]))).toBe(
      'Seg, Sáb e Dom, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('says "Todos os dias" for the whole week', () => {
    expect(summarizePriceRule(rule([0, 1, 2, 3, 4, 5, 6]))).toBe(
      'Todos os dias, 18:00–23:00: R$ 250 / hora',
    );
  });

  it('shows minutes in the range and cents in the price', () => {
    expect(summarizePriceRule(rule([1], 1110, 1440, 25050))).toBe(
      'Seg, 18:30–24:00: R$ 250,50 / hora',
    );
  });

  it('does not change the array it is given', () => {
    const weekdays = [6, 0, 5];
    summarizePriceRule(rule(weekdays));
    expect(weekdays).toEqual([6, 0, 5]);
  });
});

describe('lowestPriceCents', () => {
  const rules = (...prices: number[]) =>
    prices.map((price) => rule([6], 600, 720, price));

  it('is the base price without rules', () => {
    expect(
      lowestPriceCents({ basePriceCentsPerHour: 9000, priceRules: [] }),
    ).toBe(9000);
  });

  it('is a cheaper rule when there is one', () => {
    expect(
      lowestPriceCents({
        basePriceCentsPerHour: 9000,
        priceRules: rules(12000, 6000),
      }),
    ).toBe(6000);
  });

  it('ignores rules that cost more than the base price', () => {
    expect(
      lowestPriceCents({
        basePriceCentsPerHour: 9000,
        priceRules: rules(12000, 9000),
      }),
    ).toBe(9000);
  });
});
