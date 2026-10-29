import { SLOT_MS, localMinuteOf, localWeekdayOf } from './time.js';

export interface PriceRule {
  id: string;
  /** 0 = Sunday. */
  weekdays: readonly number[];
  startMinute: number;
  endMinute: number;
  priceCentsPerHour: number;
}

export interface PriceSegment {
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
}

/** Rule covering a segment: smallest `startMinute`, then smallest `id`. */
function ruleFor(
  rules: readonly PriceRule[],
  weekday: number,
  minute: number,
): PriceRule | undefined {
  let best: PriceRule | undefined;
  for (const r of rules) {
    if (
      !r.weekdays.includes(weekday) ||
      minute < r.startMinute ||
      minute >= r.endMinute
    ) {
      continue;
    }
    if (
      !best ||
      r.startMinute < best.startMinute ||
      (r.startMinute === best.startMinute && r.id < best.id)
    ) {
      best = r;
    }
  }
  return best;
}

/**
 * 30-minute segments of [start, end), each priced with the rule covering its
 * own weekday and minute in the venue zone, or the base price.
 */
export function priceSegments(
  start: Date,
  end: Date,
  tz: string,
  basePriceCentsPerHour: number,
  rules: readonly PriceRule[],
): PriceSegment[] {
  const span = end.getTime() - start.getTime();
  if (!(span > 0) || span % SLOT_MS !== 0) {
    throw new RangeError('Range must be a positive multiple of 30 minutes');
  }
  const segments: PriceSegment[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += SLOT_MS) {
    const startsAt = new Date(t);
    const rule = ruleFor(
      rules,
      localWeekdayOf(startsAt, tz),
      localMinuteOf(startsAt, tz),
    );
    const perHour = rule ? rule.priceCentsPerHour : basePriceCentsPerHour;
    segments.push({
      startsAt,
      endsAt: new Date(t + SLOT_MS),
      priceCents: Math.round(perHour / 2),
    });
  }
  return segments;
}
