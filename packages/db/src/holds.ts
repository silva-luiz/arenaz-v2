import { sql } from 'drizzle-orm';
import type { Db } from './client.js';

export interface ExpireDueHoldsOptions {
  /** Holds due at or before this instant expire. Defaults to the database clock. */
  cutoff?: Date;
  /** Only this field's holds (the API's lazy path, under the field lock). */
  fieldId?: string;
  /** Only this booking (the API's payment path, row already locked). */
  bookingId?: string;
  /** Rows per statement (the worker batches). Default: no limit. */
  limit?: number;
}

/**
 * The ONE definition of "a hold expired", shared by the worker and the API's
 * lazy expiry: `held` and `hold_expires_at <= cutoff` becomes `expired`,
 * cancelled by `system`. Returns how many rows it expired.
 *
 * Candidates are picked `FOR UPDATE SKIP LOCKED`: a booking row another
 * transaction is paying, cancelling or reclaiming is left alone (it, or the
 * next run, settles it), and only booking rows are locked here, so the
 * venue -> field -> booking lock order is never inverted. The outer UPDATE
 * repeats the predicate, so a hold a payment confirmed meanwhile never matches.
 */
export async function expireDueHolds(
  db: Pick<Db, 'execute'>,
  options: ExpireDueHoldsOptions = {},
): Promise<number> {
  const cutoff = options.cutoff
    ? sql`${options.cutoff.toISOString()}::timestamptz`
    : sql`now()`;
  const scope = sql.join(
    [
      options.fieldId ? sql`and field_id = ${options.fieldId}::uuid` : sql``,
      options.bookingId ? sql`and id = ${options.bookingId}::uuid` : sql``,
    ],
    sql` `,
  );
  const limit = options.limit ? sql`limit ${options.limit}` : sql``;
  const result = await db.execute<{ id: string }>(sql`
    update booking
    set status = 'expired', cancelled_by = 'system'
    where id in (
      select id from booking
      where status = 'held' and hold_expires_at <= ${cutoff} ${scope}
      order by hold_expires_at
      ${limit}
      for update skip locked
    )
    and status = 'held' and hold_expires_at <= ${cutoff}
    returning id
  `);
  return result.rows.length;
}
