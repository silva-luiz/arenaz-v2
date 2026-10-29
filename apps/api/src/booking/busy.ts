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
