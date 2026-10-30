import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { field } from './field.js';
import { tstzrange } from './geography.js';
import { venue } from './venue.js';

export interface PriceBreakdownItem {
  startsAt: string;
  endsAt: string;
  priceCents: number;
}

// Enum-like values mirror @arenaz/contracts (BOOKING_STATUSES).
export const booking = pgTable(
  'booking',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => field.id, { onDelete: 'restrict' }),
    // Denormalized from the field, for the venue agenda.
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'restrict' }),
    // null = manual booking (made by the owner).
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    origin: text('origin').notNull(),
    status: text('status').notNull(),
    // Half-open [start, end), same bounds as availability_block.
    period: tstzrange('period').notNull(),
    totalCents: integer('total_cents').notNull(),
    priceBreakdown: jsonb('price_breakdown')
      .$type<PriceBreakdownItem[]>()
      .notNull(),
    holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
  },
  (t) => [
    index('booking_venue_period_idx').on(t.venueId, sql`lower(${t.period})`),
    index('booking_user_created_idx').on(
      t.userId,
      t.createdAt.desc().nullsFirst(),
    ),
    index('booking_hold_expires_idx')
      .on(t.holdExpiresAt)
      .where(sql`${t.status} = 'held'`),
    // The denormalized venue_id must be the field's own venue.
    foreignKey({
      name: 'booking_field_venue_fk',
      columns: [t.fieldId, t.venueId],
      foreignColumns: [field.id, field.venueId],
    }).onDelete('restrict'),
    check(
      'booking_manual_customer_check',
      sql`${t.origin} <> 'manual' or (${t.customerName} is not null and btrim(${t.customerName}) <> '')`,
    ),
    check('booking_origin_check', sql`${t.origin} in ('app', 'manual')`),
    check(
      'booking_status_check',
      sql`${t.status} in ('held', 'confirmed', 'cancelled', 'expired')`,
    ),
    check(
      'booking_cancelled_by_check',
      sql`${t.cancelledBy} in ('player', 'owner', 'system')`,
    ),
    check('booking_total_check', sql`${t.totalCents} > 0`),
    check(
      'booking_period_check',
      sql`not isempty(${t.period}) and lower_inc(${t.period}) and not upper_inc(${t.period}) and not lower_inf(${t.period}) and not upper_inf(${t.period})`,
    ),
    check(
      'booking_hold_check',
      sql`${t.status} <> 'held' or ${t.holdExpiresAt} is not null`,
    ),
    // Also in migration 0007, drizzle cannot express it:
    // EXCLUDE USING gist (field_id WITH =, period WITH &&)
    //   WHERE (status IN ('held', 'confirmed'))
    // named booking_no_overlap.
  ],
);

export type Booking = typeof booking.$inferSelect;
export type NewBooking = typeof booking.$inferInsert;
