import { describe, expect, it } from 'vitest';
import { formatCep, formatMinute, formatPhoneBr } from './format-br';

describe('formatCep', () => {
  it('adds the dash to 8 digits', () => {
    expect(formatCep('01310100')).toBe('01310-100');
  });
  it('leaves anything else as typed', () => {
    expect(formatCep('0131')).toBe('0131');
    expect(formatCep('01310-100')).toBe('01310-100');
  });
});

describe('formatPhoneBr', () => {
  it('formats E.164 mobile and landline numbers', () => {
    expect(formatPhoneBr('+5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneBr('+551133334444')).toBe('(11) 3333-4444');
  });
  it('returns unknown shapes untouched', () => {
    expect(formatPhoneBr('123')).toBe('123');
    expect(formatPhoneBr('')).toBe('');
  });
});

describe('formatMinute', () => {
  it('formats minutes of the day, 1440 as 24:00', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(480)).toBe('08:00');
    expect(formatMinute(1410)).toBe('23:30');
    expect(formatMinute(1440)).toBe('24:00');
  });
});
