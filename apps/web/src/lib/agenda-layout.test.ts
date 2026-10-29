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
  const rows = [1080, 1110, 1140, 1170, 1200];

  it('puts an item in its first row with a row span, the rest is covered', () => {
    const grid = buildAgendaGrid(
      [
        { items: [booking()] },
        { items: [] },
      ],
      rows,
      '2026-11-02',
      SP,
    );
    expect(grid[0]?.[0]).toMatchObject({ kind: 'item', span: 4 });
    expect(grid[1]?.[0]).toEqual({ kind: 'covered' });
    expect(grid[3]?.[0]).toEqual({ kind: 'covered' });
    expect(grid[4]?.[0]).toEqual({ kind: 'empty' });
    expect(grid.every((row) => row[1]?.kind === 'empty')).toBe(true);
  });

  it('clips an item that starts inside the previous one', () => {
    const grid = buildAgendaGrid(
      [
        {
          items: [
            booking(),
            block({
              startsAt: '2026-11-02T22:00:00.000Z',
              endsAt: '2026-11-03T00:00:00.000Z',
            }),
          ],
        },
      ],
      [1080, 1110, 1140, 1170, 1200, 1230],
      '2026-11-02',
      SP,
    );
    expect(grid[4]?.[0]).toMatchObject({ kind: 'item', span: 2 });
  });
});

describe('itemAriaLabel', () => {
  it('announces the customer, the time range and the status', () => {
    expect(itemAriaLabel(booking(), SP)).toBe(
      'Reserva de Ana S., 18:00–20:00, confirmada',
    );
    expect(itemAriaLabel(booking({ status: 'held' }), SP)).toBe(
      'Reserva de Ana S., 18:00–20:00, aguardando pagamento',
    );
  });

  it('names the reason of a block', () => {
    expect(itemAriaLabel(block(), SP)).toBe(
      'Bloqueio, 18:00–19:00, Manutenção',
    );
    expect(itemAriaLabel(block({ reason: null }), SP)).toBe(
      'Bloqueio, 18:00–19:00',
    );
  });
});
