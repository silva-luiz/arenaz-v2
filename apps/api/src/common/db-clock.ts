import type { Db } from '@arenaz/db';
import { sql } from 'drizzle-orm';

/**
 * The database clock, read after the locks are held (not the transaction
 * start). Every time decision on a write path uses this, never the app clock.
 */
export async function dbNow(db: Pick<Db, 'execute'>): Promise<Date> {
  const result = await db.execute<{ now: Date | string }>(
    sql`SELECT clock_timestamp() AS now`,
  );
  const row = result.rows[0];
  if (!row) throw new Error('relógio do banco indisponível');
  return new Date(row.now);
}
