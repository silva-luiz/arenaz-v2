import { expireDueHolds, type Db } from '@arenaz/db';

/** Rows updated per statement, so one run never holds a huge set of locks. */
export const BATCH_SIZE = 500;

/**
 * Marks every overdue hold as `expired` (cancelled by `system`) and returns how
 * many it expired. Same semantics as the API's lazy expiry: `held` and
 * `hold_expires_at <= now` is expired.
 *
 * The SQL lives in `@arenaz/db` (`expireDueHolds`), shared with the API's lazy
 * expiry so both leave identical marks.
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
  let total = 0;
  for (;;) {
    const expired = await expireDueHolds(db, {
      ...(now ? { cutoff: now } : {}),
      limit: BATCH_SIZE,
    });
    total += expired;
    // A short batch means nothing more is due (or the rest is locked).
    if (expired < BATCH_SIZE) return total;
  }
}
