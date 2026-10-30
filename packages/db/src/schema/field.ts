import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { tstzrange } from './geography.js';
import { venue } from './venue.js';

export const field = pgTable(
  'field',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sports: text('sports').array().notNull(),
    surface: text('surface').notNull(),
    format: text('format'),
    lengthM: numeric('length_m', { precision: 5, scale: 1 }),
    widthM: numeric('width_m', { precision: 5, scale: 1 }),
    minSlotMinutes: smallint('min_slot_minutes').notNull(),
    basePriceCentsPerHour: integer('base_price_cents_per_hour').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('field_venue_id_idx').on(t.venueId),
    // Target of booking's composite FK (keeps booking.venue_id honest).
    unique('field_id_venue_id_unique').on(t.id, t.venueId),
    check('field_sports_not_empty_check', sql`cardinality(${t.sports}) > 0`),
    check(
      'field_min_slot_minutes_check',
      sql`${t.minSlotMinutes} in (30, 60, 90)`,
    ),
    check('field_base_price_check', sql`${t.basePriceCentsPerHour} > 0`),
    // NULL passes (the measures are optional); 0.0 is refused.
    check('field_length_m_check', sql`${t.lengthM} > 0`),
    check('field_width_m_check', sql`${t.widthM} > 0`),
  ],
);

export const priceRule = pgTable(
  'price_rule',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => field.id, { onDelete: 'cascade' }),
    weekdays: smallint('weekdays').array().notNull(),
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
    priceCentsPerHour: integer('price_cents_per_hour').notNull(),
    label: text('label'),
  },
  (t) => [
    index('price_rule_field_id_idx').on(t.fieldId),
    check('price_rule_minutes_check', sql`${t.startMinute} < ${t.endMinute}`),
    check('price_rule_price_check', sql`${t.priceCentsPerHour} > 0`),
    check(
      'price_rule_bounds_check',
      sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} % 30 = 0 and ${t.endMinute} % 30 = 0`,
    ),
    check(
      'price_rule_weekdays_check',
      sql`cardinality(${t.weekdays}) > 0 and ${t.weekdays} <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]`,
    ),
    check('price_rule_price_max_check', sql`${t.priceCentsPerHour} <= 1000000`),
  ],
);

export const availabilityBlock = pgTable(
  'availability_block',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => field.id, { onDelete: 'cascade' }),
    // Half-open [start, end). Reads and writes as `{ startsAt, endsAt }` (Dates);
    // overlap checks build the range with tstzrangeSql().
    period: tstzrange('period').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('availability_block_field_id_idx').on(t.fieldId),
    index('availability_block_period_idx').using('gist', t.period),
    check('availability_block_period_check', sql`not isempty(${t.period})`),
    // Always a finite half-open [start, end).
    check(
      'availability_block_bounds_check',
      sql`lower_inc(${t.period}) and not upper_inc(${t.period}) and not lower_inf(${t.period}) and not upper_inf(${t.period})`,
    ),
    // Also in migration 0006, drizzle cannot express it:
    // EXCLUDE USING gist (field_id WITH =, period WITH &&)
    // named availability_block_no_overlap (btree_gist is installed by 0000).
  ],
);

export type Field = typeof field.$inferSelect;
export type NewField = typeof field.$inferInsert;
export type PriceRule = typeof priceRule.$inferSelect;
export type NewPriceRule = typeof priceRule.$inferInsert;
export type AvailabilityBlock = typeof availabilityBlock.$inferSelect;
export type NewAvailabilityBlock = typeof availabilityBlock.$inferInsert;
