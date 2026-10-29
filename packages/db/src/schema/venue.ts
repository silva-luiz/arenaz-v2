import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { geographyPoint } from './geography.js';

// Domain tables use snake_case columns (Better Auth tables keep camelCase).
// Enum-like values mirror @arenaz/contracts (CANCELLATION_POLICIES).

export const venue = pgTable(
  'venue',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    phone: text('phone').notNull(),
    cep: text('cep').notNull(),
    street: text('street').notNull(),
    number: text('number').notNull(),
    complement: text('complement'),
    neighborhood: text('neighborhood').notNull(),
    city: text('city').notNull(),
    state: char('state', { length: 2 }).notNull(),
    location: geographyPoint('location').notNull(),
    amenities: text('amenities')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    cancellationPolicy: text('cancellation_policy').notNull(),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('venue_owner_id_idx').on(t.ownerId),
    index('venue_location_idx').using('gist', t.location),
    check(
      'venue_cancellation_policy_check',
      sql`${t.cancellationPolicy} in ('flexivel', 'moderada', 'rigida')`,
    ),
    check('venue_status_check', sql`${t.status} in ('draft', 'published')`),
  ],
);

export const venueHours = pgTable(
  'venue_hours',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    openMinute: smallint('open_minute').notNull(),
    closeMinute: smallint('close_minute').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.venueId, t.weekday] }),
    check('venue_hours_weekday_check', sql`${t.weekday} between 0 and 6`),
    check(
      'venue_hours_range_check',
      sql`${t.openMinute} >= 0 and ${t.closeMinute} <= 1440 and ${t.openMinute} < ${t.closeMinute}`,
    ),
    check(
      'venue_hours_step_check',
      sql`${t.openMinute} % 30 = 0 and ${t.closeMinute} % 30 = 0`,
    ),
  ],
);

export const venuePhoto = pgTable(
  'venue_photo',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    // Not unique: reordering would fight a unique constraint.
    position: smallint('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('venue_photo_venue_id_idx').on(t.venueId)],
);

export type Venue = typeof venue.$inferSelect;
export type NewVenue = typeof venue.$inferInsert;
export type VenueHours = typeof venueHours.$inferSelect;
export type VenuePhoto = typeof venuePhoto.$inferSelect;
export type NewVenuePhoto = typeof venuePhoto.$inferInsert;
