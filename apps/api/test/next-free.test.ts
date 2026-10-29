import { describe, expect, it } from 'vitest';
import { nextFreeTime, type NextFreeVenue } from '../src/public/next-free.js';

const TZ = 'America/Sao_Paulo';
/** Wall clock of São Paulo (UTC-3 all year) as an instant. */
const at = (date: string, hhmm: string): Date =>
  new Date(`${date}T${hhmm}:00-03:00`);
const DATE = '2026-11-03'; // a Tuesday (weekday 2)
const everyDay = (openMinute: number, closeMinute: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    openMinute,
    closeMinute,
  }));

function venue(over: Partial<NextFreeVenue> = {}): NextFreeVenue {
  return {
    id: 'v1',
    timezone: TZ,
    hours: everyDay(420, 1440),
    fields: [{ id: 'f1', minSlotMinutes: 60 }],
    ...over,
  };
}

const busy = (from: string, to: string) => ({
  start: at(DATE, from),
  end: at(DATE, to),
});

describe('nextFreeTime', () => {
  it('arredonda para cima ao próximo slot de 30 min', () => {
    expect(nextFreeTime(venue(), new Map(), at(DATE, '19:10'))).toBe('19:30');
    expect(nextFreeTime(venue(), new Map(), at(DATE, '19:30'))).toBe('19:30');
  });

  it('pula o que está ocupado até o fim da ocupação', () => {
    const map = new Map([['f1', [busy('19:30', '21:00')]]]);
    expect(nextFreeTime(venue(), map, at(DATE, '19:10'))).toBe('21:00');
  });

  it('antes da abertura, devolve a abertura', () => {
    expect(nextFreeTime(venue(), new Map(), at(DATE, '05:00'))).toBe('07:00');
  });

  it('vale a quadra livre mais cedo; quadra ocupada não atrapalha a outra', () => {
    const two = venue({
      fields: [
        { id: 'f1', minSlotMinutes: 60 },
        { id: 'f2', minSlotMinutes: 60 },
      ],
    });
    const map = new Map([
      ['f1', [busy('19:30', '21:00')]],
      ['f2', [busy('19:30', '20:00')]],
    ]);
    expect(nextFreeTime(two, map, at(DATE, '19:10'))).toBe('20:00');
  });

  it('o mínimo da quadra precisa caber antes do fechamento', () => {
    const closes = venue({ hours: everyDay(420, 1320) }); // closes 22:00
    expect(nextFreeTime(closes, new Map(), at(DATE, '21:10'))).toBeNull();
    expect(nextFreeTime(closes, new Map(), at(DATE, '20:50'))).toBe('21:00');
    const half = venue({
      hours: everyDay(420, 1320),
      fields: [{ id: 'f1', minSlotMinutes: 30 }],
    });
    expect(nextFreeTime(half, new Map(), at(DATE, '21:10'))).toBe('21:30');
  });

  it('23:40 com fechamento 24:00 e mínimo de 60 min: nada livre', () => {
    expect(nextFreeTime(venue(), new Map(), at(DATE, '23:40'))).toBeNull();
  });

  it('às 22:40 o slot das 23:00 cabe (o mínimo de 60 min termina às 24:00)', () => {
    expect(nextFreeTime(venue(), new Map(), at(DATE, '22:40'))).toBe('23:00');
  });

  it('tudo ocupado hoje: null', () => {
    const map = new Map([['f1', [busy('07:00', '23:59')]]]);
    expect(nextFreeTime(venue(), map, at(DATE, '08:00'))).toBeNull();
  });

  it('fechado hoje: null', () => {
    const closedToday = venue({
      hours: everyDay(420, 1440).filter((row) => row.weekday !== 2),
    });
    expect(nextFreeTime(closedToday, new Map(), at(DATE, '10:00'))).toBeNull();
  });

  it('sem quadra ativa: null', () => {
    expect(
      nextFreeTime(venue({ fields: [] }), new Map(), at(DATE, '10:00')),
    ).toBeNull();
  });

  it('só conta o dia local de hoje: a madrugada seguinte não vale', () => {
    // Open 18:00-24:00 and 00:00-02:00 every day; at 23:40 only the next
    // local date has free slots.
    const overnight = venue({
      hours: [...everyDay(0, 120), ...everyDay(1080, 1440)],
      fields: [{ id: 'f1', minSlotMinutes: 30 }],
    });
    expect(nextFreeTime(overnight, new Map(), at(DATE, '23:40'))).toBeNull();
    // The early morning of the same local date is still "today".
    expect(nextFreeTime(overnight, new Map(), at(DATE, '00:10'))).toBe('00:30');
  });

  it('usa o fuso do espaço, não o do servidor', () => {
    // 12:10 in Manaus (UTC-4); hours are Manaus wall clock.
    const manaus = venue({ timezone: 'America/Manaus' });
    expect(
      nextFreeTime(manaus, new Map(), new Date(`${DATE}T12:10:00-04:00`)),
    ).toBe('12:30');
  });
});
