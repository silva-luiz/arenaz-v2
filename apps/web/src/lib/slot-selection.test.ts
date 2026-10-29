import { describe, expect, it } from 'vitest';
import {
  MAX_BOOKING_MINUTES,
  overnightTail,
  selectionTotalCents,
  selectSlot,
  type PickerSlot,
  type Selection,
} from './slot-selection';

const MIN = 60_000;
const BASE = Date.parse('2026-11-06T18:00:00-03:00');

/** 30-minute starts from 18:00; `blockMinutes` is the field's minimum block. */
function slotsFor(
  blockMinutes: number,
  busy: number[] = [],
  count = 12,
): PickerSlot[] {
  return Array.from({ length: count }, (_, index) => {
    const startMs = BASE + index * 30 * MIN;
    const endMs = startMs + blockMinutes * MIN;
    return {
      startMs,
      endMs,
      available: !busy.includes(startMs),
      priceCents: blockMinutes * 100,
    };
  });
}

const at = (minutes: number) => BASE + minutes * MIN;
const sel = (from: number, to: number): Selection => ({
  startMs: at(from),
  endMs: at(to),
});

describe('selectSlot', () => {
  it('starts a selection with the minimum block', () => {
    const result = selectSlot(slotsFor(60), null, at(30));

    expect(result.selection).toEqual(sel(30, 90));
    expect(result.message).toBeUndefined();
  });

  it('extends by one block when the next block is tapped', () => {
    const result = selectSlot(slotsFor(60), sel(0, 60), at(60));

    expect(result.selection).toEqual(sel(0, 120));
  });

  it('extends 30 by 30 when the minimum block is 30', () => {
    const slots = slotsFor(30);
    let current: Selection | null = selectSlot(slots, null, at(0)).selection;
    current = selectSlot(slots, current, at(30)).selection;
    current = selectSlot(slots, current, at(60)).selection;

    expect(current).toEqual(sel(0, 90));
  });

  it('extends across several blocks at once when all of them are free', () => {
    const result = selectSlot(slotsFor(60), sel(0, 60), at(180));

    expect(result.selection).toEqual(sel(0, 240));
  });

  it('refuses to extend through a taken block and says why', () => {
    const slots = slotsFor(60, [at(120)]);

    const result = selectSlot(slots, sel(0, 60), at(180));

    expect(result.selection).toEqual(sel(0, 60));
    expect(result.message).toBe(
      'Tem um horário ocupado no meio. Escolha horários seguidos.',
    );
  });

  it('ignores a taken slot', () => {
    const slots = slotsFor(60, [at(60)]);

    const result = selectSlot(slots, sel(0, 60), at(60));

    expect(result.selection).toEqual(sel(0, 60));
  });

  it('starts over when the tap is before the selection', () => {
    const result = selectSlot(slotsFor(60), sel(120, 180), at(30));

    expect(result.selection).toEqual(sel(30, 90));
  });

  it('starts over when the tap is not aligned with the blocks', () => {
    const result = selectSlot(slotsFor(60), sel(0, 60), at(90));

    expect(result.selection).toEqual(sel(90, 150));
  });

  it('shortens the selection when a selected block is tapped', () => {
    const result = selectSlot(slotsFor(60), sel(0, 180), at(120));

    expect(result.selection).toEqual(sel(0, 120));
  });

  it('clears the selection when its first block is tapped', () => {
    const result = selectSlot(slotsFor(60), sel(0, 120), at(0));

    expect(result.selection).toBeNull();
  });

  it('does not grow past the longest booking', () => {
    const slots = slotsFor(60, [], 30);
    let current: Selection | null = null;
    for (let hour = 0; hour < MAX_BOOKING_MINUTES / 60; hour += 1) {
      current = selectSlot(slots, current, at(hour * 60)).selection;
    }
    expect(current).toEqual(sel(0, MAX_BOOKING_MINUTES));

    const result = selectSlot(slots, current, at(MAX_BOOKING_MINUTES));

    expect(result.selection).toEqual(sel(0, MAX_BOOKING_MINUTES));
    expect(result.message).toBe('A reserva dura no máximo 6 horas.');
  });
});

describe('selectionTotalCents', () => {
  it('sums the price of every block of the selection', () => {
    const slots = slotsFor(60).map((slot, index) => ({
      ...slot,
      priceCents: 1000 + index,
    }));

    expect(selectionTotalCents(slots, sel(0, 180))).toBe(1000 + 1002 + 1004);
  });

  it('is null when a block of the selection is unknown', () => {
    expect(selectionTotalCents(slotsFor(60, [], 1), sel(0, 120))).toBeNull();
  });
});

describe('overnightTail', () => {
  const MIDNIGHT = Date.parse('2026-11-07T00:00:00-03:00');
  const slot = (startMs: number, available = true): PickerSlot => ({
    startMs,
    endMs: startMs + 60 * MIN,
    available,
    priceCents: 6000,
  });
  /** Hourly starts of the day, 21:00-23:00 (the last one ends at 24:00). */
  const evening = [21, 22, 23].map((hour) =>
    slot(MIDNIGHT + (hour - 24) * 60 * MIN),
  );
  const early = (hours: number[]) =>
    hours.map((hour) => slot(MIDNIGHT + hour * 60 * MIN));

  it('continues the window with the next day slots that start at 00:00', () => {
    const tail = overnightTail(evening, early([0, 1, 2]), MIDNIGHT);

    expect(tail.map((item) => item.startMs)).toEqual([
      MIDNIGHT,
      MIDNIGHT + 60 * MIN,
      MIDNIGHT + 120 * MIN,
    ]);
  });

  it('keeps taken slots of the continuation (they show as unavailable)', () => {
    const tail = overnightTail(
      evening,
      [slot(MIDNIGHT, false), ...early([1])],
      MIDNIGHT,
    );

    expect(tail.map((item) => item.available)).toEqual([false, true]);
  });

  it('is empty when the day does not reach 24:00', () => {
    expect(overnightTail(evening.slice(0, 2), early([0, 1]), MIDNIGHT)).toEqual(
      [],
    );
  });

  it('is empty when the next day does not open at 00:00', () => {
    expect(overnightTail(evening, early([1, 2]), MIDNIGHT)).toEqual([]);
  });

  it('stops where the next day window breaks', () => {
    const tail = overnightTail(evening, early([0, 1, 4, 5]), MIDNIGHT);

    expect(tail).toHaveLength(2);
  });

  it('never goes past the longest booking', () => {
    const tail = overnightTail(
      evening,
      early(Array.from({ length: 12 }, (_, index) => index)),
      MIDNIGHT,
    );

    expect(tail).toHaveLength(MAX_BOOKING_MINUTES / 60);
  });

  it('is empty without slots', () => {
    expect(overnightTail([], early([0]), MIDNIGHT)).toEqual([]);
    expect(overnightTail(evening, [], MIDNIGHT)).toEqual([]);
  });
});

describe('selectSlot across midnight', () => {
  const MIDNIGHT = Date.parse('2026-11-07T00:00:00-03:00');
  const grid: PickerSlot[] = [22, 23, 24, 25].map((hour) => {
    const startMs = MIDNIGHT + (hour - 24) * 60 * MIN;
    return {
      startMs,
      endMs: startMs + 60 * MIN,
      available: true,
      priceCents: 6000,
    };
  });

  it('extends a selection from before midnight into the next day', () => {
    const [, eleven, midnight, one] = grid as [
      PickerSlot,
      PickerSlot,
      PickerSlot,
      PickerSlot,
    ];
    const result = selectSlot(
      grid,
      { startMs: eleven.startMs, endMs: midnight.startMs },
      one.startMs,
    );

    expect(result.selection).toEqual({
      startMs: eleven.startMs,
      endMs: one.endMs,
    });
    expect(selectionTotalCents(grid, result.selection as Selection)).toBe(
      18000,
    );
  });
});
