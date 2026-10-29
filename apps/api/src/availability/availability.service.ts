import {
  daySlots,
  localDateOf,
  localDayRange,
  type Interval,
} from '@arenaz/booking-core';
import {
  AVAILABILITY_HORIZON_DAYS,
  PUBLIC_SLUG_PATTERN,
  availabilitySchema,
  type Availability,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { VENUE_NOT_FOUND } from '../common/not-found.js';
import { DB, type DbHandle } from '../db/db.module.js';

const { venue, venueHours, field, priceRule } = schema;

const DAY_MS = 86_400_000;
/** A slot starting late in the day can run past midnight; look this far on. */
const LOOKAHEAD_MS = DAY_MS;

interface BusyRow extends Record<string, unknown> {
  field_id: string;
  starts_at: Date | string;
  ends_at: Date | string;
}

/** `date` plus `days` calendar days (both `YYYY-MM-DD`). */
function plusDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class AvailabilityService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /**
   * Slots of one local day for every active field of a published venue.
   * Taken slots are just `available: false`: no booking, user or block
   * information leaves this method. One query reads blocks and active bookings
   * (confirmed, or held and not expired) of all the fields.
   */
  async day(slug: string, date: string): Promise<Availability> {
    if (!PUBLIC_SLUG_PATTERN.test(slug)) {
      throw new NotFoundException(VENUE_NOT_FOUND);
    }
    const { db } = this.handle;
    const [row] = await db
      .select({ id: venue.id, timezone: venue.timezone })
      .from(venue)
      .where(and(eq(venue.slug, slug), eq(venue.status, 'published')))
      .limit(1);
    if (!row) throw new NotFoundException(VENUE_NOT_FOUND);

    const now = new Date();
    const today = localDateOf(now, row.timezone);
    // Dates are fixed-width, so string order is calendar order.
    if (date < today || date > plusDays(today, AVAILABILITY_HORIZON_DAYS)) {
      throw new UnprocessableEntityException({
        errors: {
          date: [
            `Escolha uma data entre hoje e ${String(AVAILABILITY_HORIZON_DAYS)} dias à frente`,
          ],
        },
      });
    }

    const [hours, fields] = await Promise.all([
      db
        .select({
          weekday: venueHours.weekday,
          openMinute: venueHours.openMinute,
          closeMinute: venueHours.closeMinute,
        })
        .from(venueHours)
        .where(eq(venueHours.venueId, row.id)),
      db
        .select({
          id: field.id,
          name: field.name,
          minSlotMinutes: field.minSlotMinutes,
          basePriceCentsPerHour: field.basePriceCentsPerHour,
        })
        .from(field)
        .where(and(eq(field.venueId, row.id), eq(field.isActive, true)))
        .orderBy(asc(field.createdAt), asc(field.id)),
    ]);
    if (fields.length === 0) {
      return availabilitySchema.parse({
        date,
        timezone: row.timezone,
        fields: [],
      });
    }
    const fieldIds = fields.map((item) => item.id);
    const idList = sql.join(
      fieldIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const range = localDayRange(date, row.timezone);
    const windowEnd = new Date(range.end.getTime() + LOOKAHEAD_MS);
    const [rules, busyRows] = await Promise.all([
      db
        .select()
        .from(priceRule)
        .where(inArray(priceRule.fieldId, fieldIds))
        .orderBy(asc(priceRule.startMinute), asc(priceRule.id)),
      db.execute<BusyRow>(sql`
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
         WHERE period && tstzrange(${range.start.toISOString()}::timestamptz, ${windowEnd.toISOString()}::timestamptz, '[)')
      `),
    ]);

    const busyByField = new Map<string, Interval[]>();
    for (const busy of busyRows.rows) {
      const list = busyByField.get(busy.field_id) ?? [];
      list.push({
        start: new Date(busy.starts_at),
        end: new Date(busy.ends_at),
      });
      busyByField.set(busy.field_id, list);
    }

    return availabilitySchema.parse({
      date,
      timezone: row.timezone,
      fields: fields.map((item) => ({
        id: item.id,
        name: item.name,
        minSlotMinutes: item.minSlotMinutes,
        slots: daySlots({
          date,
          tz: row.timezone,
          now,
          hours,
          field: item,
          rules: rules.filter((rule) => rule.fieldId === item.id),
          busy: busyByField.get(item.id) ?? [],
          horizonDays: AVAILABILITY_HORIZON_DAYS,
        }).map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          available: slot.available,
          priceCents: slot.priceCents,
        })),
      })),
    });
  }
}
