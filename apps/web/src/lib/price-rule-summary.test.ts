import { describe, expect, it } from 'vitest';
import { formatClock, summarizePriceRule } from './price-rule-summary';

function rule(
  weekdays: number[],
  startMinute = 1080,
  endMinute = 1380,
  priceCentsPerHour = 25000,
) {
  return { weekdays, startMinute, endMinute, priceCentsPerHour, label: null };
}

describe('formatClock', () => {
  it('drops the minutes on the hour', () => {
    expect(formatClock(1080)).toBe('18h');
    expect(formatClock(0)).toBe('0h');
    expect(formatClock(540)).toBe('9h');
  });

  it('pads the minutes to two digits', () => {
    expect(formatClock(1110)).toBe('18h30');
    expect(formatClock(545)).toBe('9h05');
  });

  it('writes the end of the day as 24h', () => {
    expect(formatClock(1440)).toBe('24h');
  });
});

describe('summarizePriceRule', () => {
  it('joins two days with "e" and writes the range and price', () => {
    expect(summarizePriceRule(rule([5, 6]))).toBe(
      'Sex e Sáb, 18h–23h: R$ 250 / hora',
    );
  });

  it('collapses three or more consecutive days into "a"', () => {
    expect(summarizePriceRule(rule([1, 2, 3, 4, 5]))).toBe(
      'Seg a Sex, 18h–23h: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([1, 2, 3]))).toBe(
      'Seg a Qua, 18h–23h: R$ 250 / hora',
    );
  });

  it('lists non-consecutive days with commas and a final "e"', () => {
    expect(summarizePriceRule(rule([1, 3, 5]))).toBe(
      'Seg, Qua e Sex, 18h–23h: R$ 250 / hora',
    );
  });

  it('mixes a run with the days around it', () => {
    expect(summarizePriceRule(rule([1, 2, 3, 5]))).toBe(
      'Seg a Qua e Sex, 18h–23h: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([1, 2, 4, 5]))).toBe(
      'Seg, Ter, Qui e Sex, 18h–23h: R$ 250 / hora',
    );
  });

  it('writes a single day as is', () => {
    expect(summarizePriceRule(rule([6]))).toBe('Sáb, 18h–23h: R$ 250 / hora');
  });

  it('orders by weekday index with Sunday first, however they arrive', () => {
    expect(summarizePriceRule(rule([6, 0]))).toBe(
      'Dom e Sáb, 18h–23h: R$ 250 / hora',
    );
    expect(summarizePriceRule(rule([5, 4, 3]))).toBe(
      'Qua a Sex, 18h–23h: R$ 250 / hora',
    );
  });

  it('says "Todos os dias" for the whole week', () => {
    expect(summarizePriceRule(rule([0, 1, 2, 3, 4, 5, 6]))).toBe(
      'Todos os dias, 18h–23h: R$ 250 / hora',
    );
  });

  it('shows minutes in the range and cents in the price', () => {
    expect(summarizePriceRule(rule([1], 1110, 1440, 25050))).toBe(
      'Seg, 18h30–24h: R$ 250,50 / hora',
    );
  });

  it('does not change the array it is given', () => {
    const weekdays = [6, 0, 5];
    summarizePriceRule(rule(weekdays));
    expect(weekdays).toEqual([6, 0, 5]);
  });
});
