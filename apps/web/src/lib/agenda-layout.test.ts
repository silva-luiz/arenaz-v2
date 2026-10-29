import type { AgendaBlock, AgendaBooking } from '@arenaz/contracts';
import { describe, expect, it } from 'vitest';
import {
  agendaRowMinutes,
  buildAgendaGrid,
  itemAriaLabel,
  placeItem,
  weekdayOf,
} from './agenda-layout';

const SP = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';
const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

function booking(patch: Partial<AgendaBooking> = {}): AgendaBooking {
  return {
    kind: 'booking',
    id: ID,
    startsAt: '2026-11-02T21:00:00.000Z',
    endsAt: '2026-11-02T23:00:00.000Z',
    status: 'confirmed',
    origin: 'app',
    customerName: 'Ana S.',
    customerPhone: null,
    totalCents: 36000,
    ...patch,
  };
}

function block(patch: Partial<AgendaBlock> = {}): AgendaBlock {
  return {
    kind: 'block',
    id: ID,
    startsAt: '2026-11-02T21:00:00.000Z',
    endsAt: '2026-11-02T22:00:00.000Z',
    reason: 'Manutenção',
    ...patch,
  };
}

describe('weekdayOf', () => {
  it('reads the weekday of a calendar date (0 = Sunday)', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(weekdayOf('2026-11-02')).toBe(1);
  });
});

describe('placeItem', () => {
  it('reads the minutes in the venue time zone', () => {
    // 21:00Z is 18:00 in São Paulo and 17:00 in Manaus.
    expect(placeItem(booking(), '2026-11-02', SP)).toMatchObject({
      startMinute: 18 * 60,
      endMinute: 20 * 60,
    });
    expect(placeItem(booking(), '2026-11-02', MANAUS)).toMatchObject({
      startMinute: 17 * 60,
      endMinute: 19 * 60,
    });
  });

  it('clips what spills over midnight to the day', () => {
    const night = booking({
      startsAt: '2026-11-03T01:00:00.000Z', // 22:00 on the 2nd
      endsAt: '2026-11-03T04:00:00.000Z', // 01:00 on the 3rd
    });
    expect(placeItem(night, '2026-11-02', SP)).toMatchObject({
      startMinute: 22 * 60,
      endMinute: 24 * 60,
    });
    expect(placeItem(night, '2026-11-03', SP)).toMatchObject({
      startMinute: 0,
      endMinute: 60,
    });
  });
});

describe('agendaRowMinutes', () => {
  const hours = [{ weekday: 1, openMinute: 480, closeMinute: 600 }];

  it('has a row per 30 minutes of the opening hours of that weekday', () => {
    expect(agendaRowMinutes(hours, '2026-11-02', [])).toEqual([
      480, 510, 540, 570,
    ]);
    expect(agendaRowMinutes(hours, '2026-11-03', [])).toEqual([]);
  });

  it('adds the rows of an item outside the opening hours', () => {
    const placed = placeItem(block(), '2026-11-02', SP); // 18:00-19:00
    expect(agendaRowMinutes(hours, '2026-11-02', [placed])).toEqual([
      480, 510, 540, 570, 1080, 1110,
    ]);
  });
});

describe('buildAgendaGrid', () => {
  const rows = [1080, 1110, 1140, 1170, 1200, 1230, 1260];
  const at = (hhmm: string, hhmmEnd: string, id: string) => {
    // São Paulo is UTC-3.
    const iso = (value: string) => {
      const [h = 0, m = 0] = value.split(':').map(Number);
      return new Date(Date.UTC(2026, 10, 2, h + 3, m)).toISOString();
    };
    return booking({ id, startsAt: iso(hhmm), endsAt: iso(hhmmEnd) });
  };
  const ids = (list: { item: { id: string } }[] | undefined) =>
    (list ?? []).map((entry) => entry.item.id);

  it('puts an item in its first row with a row span, the rest is covered', () => {
    const { cells, overflow } = buildAgendaGrid(
      [{ items: [booking()] }, { items: [] }],
      rows,
      '2026-11-02',
      SP,
    );
    expect(cells[0]?.[0]).toMatchObject({ kind: 'item', span: 4 });
    expect(cells[1]?.[0]).toEqual({ kind: 'covered' });
    expect(cells[3]?.[0]).toEqual({ kind: 'covered' });
    expect(cells[4]?.[0]).toEqual({ kind: 'empty' });
    expect(cells.every((row) => row[1]?.kind === 'empty')).toBe(true);
    expect(overflow).toEqual([[], []]);
  });

  it('sends an item contained in another to the overflow, never shifted', () => {
    const { cells, overflow } = buildAgendaGrid(
      [{ items: [at('18:00', '20:00', 'big'), at('18:30', '19:00', 'small')] }],
      rows,
      '2026-11-02',
      SP,
    );
    expect(cells[0]?.[0]).toMatchObject({ kind: 'item', span: 4 });
    expect(ids(overflow[0])).toEqual(['small']);
  });

  it('keeps one of two items with the same start and lists the other', () => {
    const { cells, overflow } = buildAgendaGrid(
      [{ items: [at('18:00', '19:00', 'a'), at('18:00', '19:00', 'b')] }],
      rows,
      '2026-11-02',
      SP,
    );
    expect(cells[0]?.[0]).toMatchObject({ kind: 'item', span: 2 });
    expect(overflow[0]).toHaveLength(1);
  });

  it('lists the one that overlaps partially instead of clipping it', () => {
    const { cells, overflow } = buildAgendaGrid(
      [{ items: [at('18:00', '20:00', 'a'), at('19:00', '21:00', 'b')] }],
      rows,
      '2026-11-02',
      SP,
    );
    expect(cells[0]?.[0]).toMatchObject({ kind: 'item', span: 4 });
    expect(cells[4]?.[0]).toEqual({ kind: 'empty' });
    expect(ids(overflow[0])).toEqual(['b']);
  });

  it('lists an item that does not start and end on the 30-minute rows', () => {
    const { cells, overflow } = buildAgendaGrid(
      [{ items: [at('18:10', '19:00', 'odd')] }],
      rows,
      '2026-11-02',
      SP,
    );
    expect(cells.every((row) => row[0]?.kind === 'empty')).toBe(true);
    expect(ids(overflow[0])).toEqual(['odd']);
  });

  it('every item is either placed or listed', () => {
    const items = [
      at('18:00', '19:00', 'a'),
      at('18:30', '19:30', 'b'),
      at('19:00', '20:00', 'c'),
      at('19:15', '19:45', 'd'),
    ];
    const { cells, overflow } = buildAgendaGrid(
      [{ items }],
      rows,
      '2026-11-02',
      SP,
    );
    const placedIds = cells
      .map((row) => row[0])
      .flatMap((cell) => (cell?.kind === 'item' ? [cell.placed.item.id] : []));
    expect([...placedIds, ...ids(overflow[0])].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});

describe('itemAriaLabel', () => {
  it('announces court, time range, customer, origin and status', () => {
    expect(itemAriaLabel(booking(), 'Quadra 1', SP)).toBe(
      'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
    );
    expect(itemAriaLabel(booking({ status: 'held' }), 'Quadra 1', SP)).toBe(
      'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, aguardando pagamento',
    );
    expect(itemAriaLabel(booking({ origin: 'manual' }), 'Quadra 2', SP)).toBe(
      'Quadra 2, 18:00–20:00, reserva de Ana S., manual, confirmada',
    );
  });

  it('names the reason of a block', () => {
    expect(itemAriaLabel(block(), 'Quadra 1', SP)).toBe(
      'Quadra 1, 18:00–19:00, bloqueio, Manutenção',
    );
    expect(itemAriaLabel(block({ reason: null }), 'Quadra 1', SP)).toBe(
      'Quadra 1, 18:00–19:00, bloqueio, sem motivo',
    );
  });
});
