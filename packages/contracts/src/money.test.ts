import { describe, expect, it } from 'vitest';
import { formatCents, parseBrlToCents } from './money.js';

describe('parseBrlToCents', () => {
  it.each([
    ['R$ 1.234,50', 123450],
    ['120', 12000],
    ['120,5', 12050],
    ['0,99', 99],
    ['R$120,00', 12000],
    ['  R$  1.000  ', 100000],
    ['1234,5', 123450],
    ['0', 0],
  ])('parseBrlToCents(%s) → %i', (raw, cents) => {
    expect(parseBrlToCents(raw)).toBe(cents);
  });

  it.each([
    '',
    'abc',
    '12,345',
    '-5',
    '1.2.3',
    'R$',
    '1,',
    ',50',
    '1.23',
    '12.34,50',
  ])('parseBrlToCents(%s) → null', (raw) => {
    expect(parseBrlToCents(raw)).toBeNull();
  });

  it('retorna null quando o valor excede o inteiro seguro', () => {
    expect(parseBrlToCents('9'.repeat(40))).toBeNull();
  });
});

describe('formatCents', () => {
  it('formata em reais com espaço comum', () => {
    expect(formatCents(123450)).toBe('R$ 1.234,50');
    expect(formatCents(99)).toBe('R$ 0,99');
    expect(formatCents(12000)).toBe('R$ 120,00');
  });

  it('não contém espaços não separáveis', () => {
    expect(formatCents(123450)).not.toMatch(/[^\x20-\x7e]/);
  });
});
