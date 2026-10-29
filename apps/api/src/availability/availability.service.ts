import {
  addDays,
  daySlots,
  localDateOf,
  localDayRange,
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
import { and, asc, eq, inArray } from 'drizzle-orm';
import { loadBusy } from '../booking/busy.js';
import { VENUE_NOT_FOUND } from '../common/not-found.js';
import { DB, type DbHandle } from '../db/db.module.js';

const { venue, venueHours, field, priceRule } = schema;

const DAY_MS = 86_400_000;
/** A slot starting late in the day can run past midnight; look this far on. */
const LOOKAHEAD_MS = DAY_MS;

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
    if (date < today || date > addDays(today, AVAILABILITY_HORIZON_DAYS)) {
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

    const range = localDayRange(date, row.timezone);
    const windowEnd = new Date(range.end.getTime() + LOOKAHEAD_MS);
    const [rules, busyByField] = await Promise.all([
      db
        .select()
        .from(priceRule)
        .where(inArray(priceRule.fieldId, fieldIds))
        .orderBy(asc(priceRule.startMinute), asc(priceRule.id)),
      loadBusy(db, fieldIds, range.start, windowEnd, now),
    ]);

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
