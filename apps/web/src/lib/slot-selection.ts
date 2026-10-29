import { BOOKING_MAX_MINUTES } from '@arenaz/contracts';

export const MAX_BOOKING_MINUTES = BOOKING_MAX_MINUTES;

const MINUTE_MS = 60_000;

/**
 * One start time of the grid. `endMs` is the end of the court's MINIMUM block
 * starting there, and `priceCents` is the price of that block (what the API
 * sends); `available` says the whole block is free.
 */
export interface PickerSlot {
  startMs: number;
  endMs: number;
  available: boolean;
  priceCents: number;
}

/** The chosen stretch, `[startMs, endMs)`, a whole number of blocks long. */
export interface Selection {
  startMs: number;
  endMs: number;
}

export interface SelectResult {
  selection: Selection | null;
  /** Why the tap did not do what it looks like it should. */
  message?: string;
}

export const GAP_MESSAGE =
  'Tem um horário ocupado no meio. Escolha horários seguidos.';
export const TOO_LONG_MESSAGE = 'A reserva dura no máximo 6 horas.';

function indexByStart(slots: readonly PickerSlot[]): Map<number, PickerSlot> {
  return new Map(slots.map((slot) => [slot.startMs, slot]));
}

/**
 * What a tap on the time that starts at `tapMs` does to the selection.
 *
 * A selection grows by whole minimum blocks (30 minutes on a court whose
 * minimum is 30): the API prices the minimum block starting at each time, so
 * a stretch that is a whole number of blocks is the only one whose total can
 * be added up exactly from what it sends. Each block must be free; a taken
 * one in the middle leaves the selection as it was.
 *
 * - no selection, a tap before it or off its blocks: starts a new selection;
 * - a tap on a later block: extends up to it (through free blocks only);
 * - a tap on a selected block: shortens to just before it (the first one
 *   clears the selection).
 */
export function selectSlot(
  slots: readonly PickerSlot[],
  selection: Selection | null,
  tapMs: number,
): SelectResult {
  const byStart = indexByStart(slots);
  const tapped = byStart.get(tapMs);
  if (!tapped?.available) return { selection };

  const block = tapped.endMs - tapped.startMs;
  const fresh: SelectResult = {
    selection: { startMs: tapped.startMs, endMs: tapped.endMs },
  };
  if (!selection) return fresh;

  const aligned = (tapMs - selection.startMs) % block === 0;
  if (tapMs < selection.startMs || !aligned) return fresh;

  if (tapMs < selection.endMs) {
    return {
      selection:
        tapMs === selection.startMs
          ? null
          : { startMs: selection.startMs, endMs: tapMs },
    };
  }

  const newEnd = tapMs + block;
  if ((newEnd - selection.startMs) / MINUTE_MS > MAX_BOOKING_MINUTES) {
    return { selection, message: TOO_LONG_MESSAGE };
  }
  for (let start = selection.endMs; start <= tapMs; start += block) {
    if (!byStart.get(start)?.available) {
      return { selection, message: GAP_MESSAGE };
    }
  }
  return { selection: { startMs: selection.startMs, endMs: newEnd } };
}

/**
 * Sum of the block prices of the selection; `null` when a block is unknown
 * (the grid changed under the selection).
 */
export function selectionTotalCents(
  slots: readonly PickerSlot[],
  selection: Selection,
): number | null {
  const byStart = indexByStart(slots);
  const first = byStart.get(selection.startMs);
  if (!first) return null;
  const block = first.endMs - first.startMs;
  let total = 0;
  for (let start = selection.startMs; start < selection.endMs; start += block) {
    const slot = byStart.get(start);
    if (!slot) return null;
    total += slot.priceCents;
  }
  return total;
}

/**
 * The hours after midnight that continue a day's last window: when the
 * court's last slot of the day ends exactly at `midnightMs` (24:00), the
 * leading run of the next day's slots that starts at `midnightMs` and has no
 * break is the rest of the same opening (the API joins a window ending at
 * 24:00 with one starting at 00:00 of the next day). Empty when the day
 * closes earlier or the next day does not open at 00:00. Capped at the
 * longest booking: nothing past it could be part of one starting tonight.
 */
export function overnightTail<T extends PickerSlot>(
  daySlots: readonly T[],
  nextDaySlots: readonly T[],
  midnightMs: number,
): T[] {
  const reachesMidnight = daySlots.some((slot) => slot.endMs >= midnightMs);
  if (!reachesMidnight) return [];

  const sorted = [...nextDaySlots].sort((a, b) => a.startMs - b.startMs);
  const limitMs = midnightMs + MAX_BOOKING_MINUTES * MINUTE_MS;
  const tail: T[] = [];
  // Starts may come closer than a block (every 30 minutes on a 60 minute
  // court): the run goes on while the next start is inside or touching the
  // end of the last one, and breaks at a gap (the window closed).
  let coveredUntil = midnightMs;
  for (const slot of sorted) {
    if (slot.startMs >= limitMs || slot.startMs > coveredUntil) break;
    if (tail.length === 0 && slot.startMs !== midnightMs) break;
    tail.push(slot);
    coveredUntil = Math.max(coveredUntil, slot.endMs);
  }
  return tail;
}
