import { describe, expect, it } from 'vitest';
import {
  dashboardDateLabel,
  firstName,
  greetingFor,
  ownerGreeting,
} from './owner-dashboard';

describe('greetingFor', () => {
  it.each([
    [5, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [23, 'Boa noite'],
    [0, 'Boa noite'],
    [4, 'Boa noite'],
  ])('%i h -> %s', (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe('firstName', () => {
  it('takes the first word, trimmed', () => {
    expect(firstName('  Marcos  Almeida ')).toBe('Marcos');
    expect(firstName('Ana')).toBe('Ana');
    expect(firstName('   ')).toBe('');
  });
});

describe('ownerGreeting', () => {
  it('uses the hour of the venue, not the server', () => {
    // 21:30 UTC is 18:30 in São Paulo and 17:30 in Manaus.
    const now = new Date('2026-10-28T21:30:00Z');
    expect(ownerGreeting('Marcos Almeida', 'America/Sao_Paulo', now)).toBe(
      'Boa noite, Marcos',
    );
    expect(ownerGreeting('Marcos Almeida', 'America/Manaus', now)).toBe(
      'Boa tarde, Marcos',
    );
    // 08:00 UTC is 05:00 in São Paulo.
    expect(
      ownerGreeting(
        'Marcos',
        'America/Sao_Paulo',
        new Date('2026-10-28T08:00:00Z'),
      ),
    ).toBe('Bom dia, Marcos');
  });

  it('greets without a name when there is none', () => {
    expect(
      ownerGreeting('', 'America/Sao_Paulo', new Date('2026-10-28T15:00:00Z')),
    ).toBe('Boa tarde');
  });
});

describe('dashboardDateLabel', () => {
  it('reads like the prototype: weekday without "-feira", day and month', () => {
    expect(dashboardDateLabel('2026-10-28')).toBe('Quarta, 28 de outubro');
    expect(dashboardDateLabel('2026-11-01')).toBe('Domingo, 1 de novembro');
    expect(dashboardDateLabel('2026-10-31')).toBe('Sábado, 31 de outubro');
    expect(dashboardDateLabel('2026-12-07')).toBe('Segunda, 7 de dezembro');
  });
});
