import {
  schema,
  type Db,
  type Field as FieldRow,
  type Venue as VenueRow,
} from '@arenaz/db';
import { NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { FIELD_NOT_FOUND, VENUE_NOT_FOUND } from '../common/not-found.js';

export type { FieldRow, VenueRow };

/** A `Db` or a transaction handle: all the helpers need is `select`. */
export type Reader = Pick<Db, 'select'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects a malformed uuid with an error (a 500); check up front. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * The venue, if it exists AND belongs to `userId`. Someone else's venue is
 * indistinguishable from a missing one (404, never 403), as is a malformed id.
 */
export async function findOwnedVenue(
  db: Reader,
  venueId: string,
  userId: string,
): Promise<VenueRow> {
  if (!isUuid(venueId)) throw new NotFoundException(VENUE_NOT_FOUND);
  const [row] = await db
    .select()
    .from(schema.venue)
    .where(and(eq(schema.venue.id, venueId), eq(schema.venue.ownerId, userId)))
    .limit(1);
  if (!row) throw new NotFoundException(VENUE_NOT_FOUND);
  return row;
}

/**
 * The field, if it belongs to a venue owned by `userId` (field → venue
 * join). Same 404 rules as `findOwnedVenue`.
 */
export async function findOwnedField(
  db: Reader,
  fieldId: string,
  userId: string,
): Promise<FieldRow> {
  if (!isUuid(fieldId)) throw new NotFoundException(FIELD_NOT_FOUND);
  const [row] = await db
    .select({ field: schema.field })
    .from(schema.field)
    .innerJoin(schema.venue, eq(schema.field.venueId, schema.venue.id))
    .where(and(eq(schema.field.id, fieldId), eq(schema.venue.ownerId, userId)))
    .limit(1);
  if (!row) throw new NotFoundException(FIELD_NOT_FOUND);
  return row.field;
}
