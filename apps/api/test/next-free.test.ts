import { describe, expect, it } from 'vitest';
import {
  freeTimes,
  nextFreeTime,
  type NextFreeVenue,
} from '../src/public/next-free.js';

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

describe('freeTimes', () => {
  it('lista os 3 primeiros inícios livres, em ordem, e o primeiro é o nextFreeTime', () => {
    const map = new Map([['f1', [busy('19:30', '21:00')]]]);
    const now = at(DATE, '19:10');
    expect(freeTimes(venue(), map, now)).toEqual(['21:00', '21:30', '22:00']);
    expect(nextFreeTime(venue(), map, now)).toBe('21:00');
  });

  it('cada horário aparece uma vez, mesmo livre em duas quadras', () => {
    const two = venue({
      fields: [
        { id: 'f1', minSlotMinutes: 60 },
        { id: 'f2', minSlotMinutes: 60 },
      ],
    });
    expect(freeTimes(two, new Map(), at(DATE, '19:10'))).toEqual([
      '19:30',
      '20:00',
      '20:30',
    ]);
  });

  it('junta as quadras: o que uma ocupa a outra completa', () => {
    const two = venue({
      fields: [
        { id: 'f1', minSlotMinutes: 60 },
        { id: 'f2', minSlotMinutes: 60 },
      ],
    });
    const map = new Map([
      ['f1', [busy('19:30', '23:30')]],
      ['f2', [busy('19:30', '22:00')]],
    ]);
    expect(freeTimes(two, map, at(DATE, '19:10'))).toEqual([
      '22:00',
      '22:30',
      '23:00',
    ]);
  });

  it('traz menos de 3 quando não há mais, e [] sem nada livre', () => {
    const closes = venue({ hours: everyDay(420, 1320) }); // closes 22:00
    expect(freeTimes(closes, new Map(), at(DATE, '20:40'))).toEqual(['21:00']);
    expect(freeTimes(closes, new Map(), at(DATE, '21:10'))).toEqual([]);
    expect(
      freeTimes(venue({ fields: [] }), new Map(), at(DATE, '10:00')),
    ).toEqual([]);
  });

  it('só conta o dia local de hoje', () => {
    const overnight = venue({
      hours: [...everyDay(0, 120), ...everyDay(1080, 1440)],
      fields: [{ id: 'f1', minSlotMinutes: 30 }],
    });
    expect(freeTimes(overnight, new Map(), at(DATE, '23:10'))).toEqual([
      '23:30',
    ]);
  });
});
