import type { Interval } from '@arenaz/booking-core';
import type { Db } from '@arenaz/db';
import { sql } from 'drizzle-orm';

interface BusyRow extends Record<string, unknown> {
  field_id: string;
  starts_at: Date | string;
  ends_at: Date | string;
}

/**
 * Blocks and active bookings (confirmed, or held and not expired at `now`) of
 * the given fields that touch `[from, to)`, by field. Same rule as the public
 * availability, so what the player sees free is what the booking accepts.
 */
export async function loadBusy(
  db: Pick<Db, 'execute'>,
  fieldIds: readonly string[],
  from: Date,
  to: Date,
  now: Date,
): Promise<Map<string, Interval[]>> {
  const byField = new Map<string, Interval[]>();
  if (fieldIds.length === 0) return byField;
  const idList = sql.join(
    fieldIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const result = await db.execute<BusyRow>(sql`
    SELECT field_id, lower(period) AS starts_at, upper(period) AS ends_at
      FROM (
        SELECT field_id, period FROM availability_block
         WHERE field_id IN (${idList})
        UNION ALL
        SELECT field_id, period FROM booking
         WHERE field_id IN (${idList})
           AND (status = 'confirmed'
                OR (status = 'held' AND hold_expires_at > ${now.toISOString()}::timestamptz))
      ) busy
     WHERE period && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')
  `);
  for (const row of result.rows) {
    const list = byField.get(row.field_id) ?? [];
    list.push({ start: new Date(row.starts_at), end: new Date(row.ends_at) });
    byField.set(row.field_id, list);
  }
  return byField;
}

/** What counts as an active booking: confirmed, or a hold still alive at `now`. */
export const ACTIVE_AT = (now: Date) => sql`(status = 'confirmed'
  OR (status = 'held' AND hold_expires_at > ${now.toISOString()}::timestamptz))`;

/**
 * Whether the field (or every field of the venue) has an active booking that
 * has not ended yet at `now`. A booking in progress counts (it blocks delete,
 * deactivate and unpublish) although the owner cannot cancel it: cancelling
 * is for bookings that have not started. The owner's delete/deactivate/unpublish rules
 * use it; call it after taking the field locks so a hold being created
 * cannot slip in between the check and the change.
 */
export async function hasUpcomingActiveBooking(
  db: Pick<Db, 'execute'>,
  scope: { fieldId: string } | { venueId: string },
  now: Date,
): Promise<boolean> {
  const where =
    'fieldId' in scope
      ? sql`field_id = ${scope.fieldId}::uuid`
      : sql`venue_id = ${scope.venueId}::uuid`;
  const result = await db.execute<{ found: number }>(sql`
    SELECT 1 AS found FROM booking
     WHERE ${where} AND ${ACTIVE_AT(now)}
       AND upper(period) > ${now.toISOString()}::timestamptz
     LIMIT 1
  `);
  return result.rows.length > 0;
}

/** Whether an active booking of the field overlaps `[from, to)`. */
export async function hasActiveBookingIn(
  db: Pick<Db, 'execute'>,
  fieldId: string,
  from: Date,
  to: Date,
  now: Date,
): Promise<boolean> {
  const result = await db.execute<{ found: number }>(sql`
    SELECT 1 AS found FROM booking
     WHERE field_id = ${fieldId}::uuid AND ${ACTIVE_AT(now)}
       AND period && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')
     LIMIT 1
  `);
  return result.rows.length > 0;
}

/**
 * Whether any booking of the field (or venue) was ever paid: confirmed now, or
 * cancelled after confirmation (`confirmed_at` is never cleared). Paid history
 * must survive, so these block a hard delete.
 */
export async function hasPaidHistory(
  db: Pick<Db, 'execute'>,
  scope: { fieldId: string } | { venueId: string },
): Promise<boolean> {
  const where =
    'fieldId' in scope
      ? sql`field_id = ${scope.fieldId}::uuid`
      : sql`venue_id = ${scope.venueId}::uuid`;
  const result = await db.execute<{ found: number }>(sql`
    SELECT 1 AS found FROM booking
     WHERE ${where} AND (status = 'confirmed' OR confirmed_at IS NOT NULL)
     LIMIT 1
  `);
  return result.rows.length > 0;
}
