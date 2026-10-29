import type { Db } from '@arenaz/db';
import { sql } from 'drizzle-orm';

/** Rows updated per statement, so one run never holds a huge set of locks. */
export const BATCH_SIZE = 500;

/**
 * Marks every overdue hold as `expired` (cancelled by `system`) and returns how
 * many it expired. Same semantics as the API's lazy expiry: `held` and
 * `hold_expires_at <= now` is expired.
 *
 * Safe next to the API's locked transactions:
 * - the UPDATE is guarded by `status = 'held'` and the deadline, so a booking
 *   a payment already confirmed (which clears `hold_expires_at`) never matches;
 * - candidates are picked `FOR UPDATE SKIP LOCKED`: a row an API transaction is
 *   paying, cancelling or reclaiming right now is left for the next run, the
 *   worker never waits on it nor inverts the API's field -> booking lock order
 *   (it only ever locks booking rows).
 *
 * `now` defaults to the database clock.
 */
export async function expireHolds(db: Db, now?: Date): Promise<number> {
  const cutoff = now ? sql`${now.toISOString()}::timestamptz` : sql`now()`;
  let total = 0;
  for (;;) {
    const result = await db.execute<{ id: string }>(sql`
      update booking
      set status = 'expired', cancelled_by = 'system'
      where id in (
        select id from booking
        where status = 'held' and hold_expires_at <= ${cutoff}
        order by hold_expires_at
        limit ${BATCH_SIZE}
        for update skip locked
      )
      and status = 'held' and hold_expires_at <= ${cutoff}
      returning id
    `);
    total += result.rows.length;
    // A short batch means nothing more is due (or the rest is locked).
    if (result.rows.length < BATCH_SIZE) return total;
  }
}
