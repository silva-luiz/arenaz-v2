import { validateBooking, type PriceSegment } from '@arenaz/booking-core';
import { AVAILABILITY_HORIZON_DAYS } from '@arenaz/contracts';
import { expireDueHolds, schema, type Db } from '@arenaz/db';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { dbNow } from '../common/db-clock.js';
import { FIELD_NOT_FOUND, VENUE_NOT_FOUND } from '../common/not-found.js';
import { FIELD_INACTIVE, bookingRuleError } from './booking-errors.js';
import { loadBusy } from './busy.js';

const { venue, venueHours, field, priceRule } = schema;

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const MINUTE_MS = 60_000;

/** `SELECT ... FROM field WHERE id = $1 FOR UPDATE`: every booking write starts here. */
export async function lockField(tx: Tx, fieldId: string) {
  const [row] = await tx
    .select({
      id: field.id,
      venueId: field.venueId,
      isActive: field.isActive,
      minSlotMinutes: field.minSlotMinutes,
      basePriceCentsPerHour: field.basePriceCentsPerHour,
    })
    .from(field)
    .where(eq(field.id, fieldId))
    .for('update');
  return row;
}

/** The booking's priceBreakdown column, from the priced segments. */
export function toPriceBreakdown(segments: readonly PriceSegment[]) {
  return segments.map((segment) => ({
    startsAt: segment.startsAt.toISOString(),
    endsAt: segment.endsAt.toISOString(),
    priceCents: segment.priceCents,
  }));
}

/**
 * The shared first half of every booking write (player hold and owner manual
 * booking): under the field row lock, read the clock, free stale holds, load
 * the venue's hours, the field's rules and what is busy, and run
 * `validateBooking`. Throws the HTTP error of a failed rule. The caller
 * inserts the row with `target.venueId` (the locked field's own venue).
 *
 * `player`: inactive field or unpublished venue is a 404. `owner`: an
 * inactive field is a 422 and the venue may be a draft.
 */
export async function validateUnderFieldLock(
  tx: Tx,
  input: {
    fieldId: string;
    startsAt: Date;
    durationMinutes: number;
    audience: 'player' | 'owner';
  },
) {
  const target = await lockField(tx, input.fieldId);
  if (!target) throw new NotFoundException(FIELD_NOT_FOUND);
  if (!target.isActive) {
    throw input.audience === 'player'
      ? new NotFoundException(FIELD_NOT_FOUND)
      : new UnprocessableEntityException(FIELD_INACTIVE);
  }
  const [place] = await tx
    .select({ timezone: venue.timezone, status: venue.status })
    .from(venue)
    .where(eq(venue.id, target.venueId))
    .limit(1);
  if (!place) throw new NotFoundException(VENUE_NOT_FOUND);
  if (input.audience === 'player' && place.status !== 'published') {
    throw new NotFoundException(VENUE_NOT_FOUND);
  }

  const now = await dbNow(tx);
  // Same helper (and marks) as the worker: stale holds of this field.
  await expireDueHolds(tx, { fieldId: target.id, cutoff: now });

  const endsAt = new Date(
    input.startsAt.getTime() + input.durationMinutes * MINUTE_MS,
  );
  const hours = await tx
    .select({
      weekday: venueHours.weekday,
      openMinute: venueHours.openMinute,
      closeMinute: venueHours.closeMinute,
    })
    .from(venueHours)
    .where(eq(venueHours.venueId, target.venueId));
  const rules = await tx
    .select()
    .from(priceRule)
    .where(eq(priceRule.fieldId, target.id))
    .orderBy(asc(priceRule.startMinute), asc(priceRule.id));
  const busy = await loadBusy(tx, [target.id], input.startsAt, endsAt, now);

  const result = validateBooking({
    start: input.startsAt,
    durationMinutes: input.durationMinutes,
    tz: place.timezone,
    now,
    hours,
    field: target,
    rules,
    busy: busy.get(target.id) ?? [],
    horizonDays: AVAILABILITY_HORIZON_DAYS,
  });
  if (!result.ok) throw bookingRuleError(result.code, target.minSlotMinutes);
  return { target, now, endsAt, result };
}
