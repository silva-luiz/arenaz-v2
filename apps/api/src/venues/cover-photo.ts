import { schema } from '@arenaz/db';
import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

const { venuePhoto } = schema;

/**
 * Drizzle drops the table qualifier in single-table selects, which would make
 * `venue.id` inside a correlated subquery resolve to the inner table. Spell
 * the outer reference out.
 */
export const OUTER_VENUE_ID = sql.raw('"venue"."id"');

/**
 * `column` of the venue's cover photo (position 0, the oldest on a tie), as a
 * correlated subquery of the outer venue row. The query must have the
 * `venue` table in scope under its own name (not aliased).
 */
export function coverPhoto<T>(column: AnyPgColumn): SQL<T | null> {
  return sql<T | null>`(select ${column} from ${venuePhoto} where ${venuePhoto.venueId} = ${OUTER_VENUE_ID} order by ${venuePhoto.position}, ${venuePhoto.createdAt} limit 1)`;
}
