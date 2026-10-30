import {
  addDays,
  localDayRange,
  localWeekdayOf,
  openWindows,
  toInstant,
  type Interval,
} from '@arenaz/booking-core';
import {
  agendaBookingSchema,
  ownerAgendaSchema,
  ownerVenueSummarySchema,
  type AgendaBooking,
  type AgendaItem,
  type ManualBookingInput,
  type OwnerAgenda,
  type OwnerVenueSummary,
} from '@arenaz/contracts';
import { schema, tstzrangeSql, type Db } from '@arenaz/db';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
import {
  BOOKING_NOT_FOUND,
  CANNOT_CANCEL,
  SLOT_TAKEN,
} from '../booking/booking-errors.js';
import {
  toPriceBreakdown,
  validateUnderFieldLock,
  type Tx,
} from '../booking/booking-context.js';
import { ACTIVE_AT } from '../booking/busy.js';
import { dbNow } from '../common/db-clock.js';
import { EXCLUSION_VIOLATION, hasPgCode } from '../common/pg-errors.js';
import { shortName } from '../common/text.js';
import { DB, type DbHandle } from '../db/db.module.js';
import { findOwnedField, findOwnedVenue, isUuid } from '../venues/owner.js';

const { booking, venue, venueHours, field, availabilityBlock, user } = schema;

const MINUTE_MS = 60_000;

const bookingColumns = {
  id: booking.id,
  fieldId: booking.fieldId,
  status: booking.status,
  origin: booking.origin,
  period: booking.period,
  totalCents: booking.totalCents,
  customerName: booking.customerName,
  customerPhone: booking.customerPhone,
  playerName: user.name,
};

type BookingRow = {
  id: string;
  status: string;
  origin: string;
  period: { startsAt: Date; endsAt: Date };
  totalCents: number;
  customerName: string | null;
  customerPhone: string | null;
  playerName: string | null;
};

/** Minutes of `[start, end)` that fall inside the windows. */
function minutesInside(
  windows: readonly Interval[],
  start: Date,
  end: Date,
): number {
  let total = 0;
  for (const window of windows) {
    const from = Math.max(window.start.getTime(), start.getTime());
    const to = Math.min(window.end.getTime(), end.getTime());
    if (to > from) total += to - from;
  }
  return total / MINUTE_MS;
}

/** Manual: the name the owner typed. App: first name and surname initial. */
function toItem(row: BookingRow): AgendaBooking {
  return agendaBookingSchema.parse({
    kind: 'booking',
    id: row.id,
    startsAt: row.period.startsAt.toISOString(),
    endsAt: row.period.endsAt.toISOString(),
    status: row.status,
    origin: row.origin,
    customerName:
      row.origin === 'manual'
        ? (row.customerName ?? '')
        : shortName(row.playerName ?? ''),
    customerPhone: row.origin === 'manual' ? row.customerPhone : null,
    totalCents: row.totalCents,
  });
}

@Injectable()
export class AgendaService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /**
   * The owner's day: every field of the venue with its bookings (confirmed, or
   * held and still alive) and blocks that touch the local day, in start order.
   * Customer names and phones are the owner's own business; nothing here is
   * reachable for someone else's venue (404).
   */
  async day(
    userId: string,
    venueId: string,
    date: string,
  ): Promise<OwnerAgenda> {
    const { db } = this.handle;
    const owned = await findOwnedVenue(db, venueId, userId);
    const range = localDayRange(date, owned.timezone);
    const window = tstzrangeSql(range.start, range.end);
    const now = await dbNow(db);

    const fields = await db
      .select({ id: field.id, name: field.name, isActive: field.isActive })
      .from(field)
      .where(eq(field.venueId, owned.id))
      .orderBy(asc(field.createdAt), asc(field.id));
    const bookings = await db
      .select(bookingColumns)
      .from(booking)
      .leftJoin(user, eq(user.id, booking.userId))
      .where(
        and(
          eq(booking.venueId, owned.id),
          sql`${booking.period} && ${window}`,
          or(
            eq(booking.status, 'confirmed'),
            and(eq(booking.status, 'held'), gt(booking.holdExpiresAt, now)),
          ),
        ),
      );
    const blocks = await db
      .select({
        id: availabilityBlock.id,
        fieldId: availabilityBlock.fieldId,
        period: availabilityBlock.period,
        reason: availabilityBlock.reason,
      })
      .from(availabilityBlock)
      .innerJoin(field, eq(field.id, availabilityBlock.fieldId))
      .where(
        and(
          eq(field.venueId, owned.id),
          sql`${availabilityBlock.period} && ${window}`,
        ),
      );

    return ownerAgendaSchema.parse({
      date,
      timezone: owned.timezone,
      fields: fields.map((item) => {
        const items: AgendaItem[] = [
          ...bookings
            .filter((row) => row.fieldId === item.id)
            .map((row) => toItem(row)),
          ...blocks
            .filter((row) => row.fieldId === item.id)
            .map((row): AgendaItem => ({
              kind: 'block',
              id: row.id,
              startsAt: row.period.startsAt.toISOString(),
              endsAt: row.period.endsAt.toISOString(),
              reason: row.reason,
            })),
        ].sort(
          (a, b) =>
            a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
        );
        return { id: item.id, name: item.name, isActive: item.isActive, items };
      }),
    });
  }

  /**
   * The owner's numbers for `date`, in the venue's zone.
   *
   * Occupancy: minutes of active bookings (confirmed, or held and alive; the
   * same rule as the availability) of the active courts that fall inside the
   * opening hours of that day, over the open minutes of the day times the
   * active courts. Blocks are not bookings. Revenue: `total_cents` of the
   * confirmed app bookings that start in the Monday–Sunday week of `date`
   * (manual bookings are paid at the venue).
   */
  async summary(
    userId: string,
    venueId: string,
    date: string,
  ): Promise<OwnerVenueSummary> {
    const { db } = this.handle;
    const owned = await findOwnedVenue(db, venueId, userId);
    const tz = owned.timezone;
    const day = localDayRange(date, tz);
    const now = await dbNow(db);

    const hours = await db
      .select({
        weekday: venueHours.weekday,
        openMinute: venueHours.openMinute,
        closeMinute: venueHours.closeMinute,
      })
      .from(venueHours)
      .where(eq(venueHours.venueId, owned.id));
    // The windows of the day only: an overnight shift's tail belongs to the
    // next day, where it is that day's opening.
    const windows = openWindows(date, tz, hours).map((window) => ({
      start: window.start,
      end: new Date(Math.min(window.end.getTime(), day.end.getTime())),
    }));
    const openPerCourt = minutesInside(windows, day.start, day.end);

    const active = await db
      .select({ id: field.id })
      .from(field)
      .where(and(eq(field.venueId, owned.id), eq(field.isActive, true)));
    const openMinutes = openPerCourt * active.length;

    let occupancyPct = 0;
    if (openMinutes > 0) {
      const window = tstzrangeSql(day.start, day.end);
      const busy = await db
        .select({ period: booking.period })
        .from(booking)
        .innerJoin(field, eq(field.id, booking.fieldId))
        .where(
          and(
            eq(booking.venueId, owned.id),
            eq(field.isActive, true),
            sql`${booking.period} && ${window}`,
            ACTIVE_AT(now),
          ),
        );
      // Bookings of one court never overlap (EXCLUDE), so the sum is exact.
      const booked = busy.reduce(
        (sum, row) =>
          sum + minutesInside(windows, row.period.startsAt, row.period.endsAt),
        0,
      );
      occupancyPct = Math.min(100, Math.round((booked * 100) / openMinutes));
    }

    // Monday of the week of `date` (weekday 0 is Sunday; noon is always on
    // the local date).
    const weekday = localWeekdayOf(toInstant(date, 12 * 60, tz), tz);
    const monday = addDays(date, -((weekday + 6) % 7));
    const weekStart = toInstant(monday, 0, tz);
    const weekEnd = toInstant(addDays(monday, 7), 0, tz);
    const [revenue] = await db
      .select({
        cents: sql<string>`coalesce(sum(${booking.totalCents}), 0)`,
      })
      .from(booking)
      .where(
        and(
          eq(booking.venueId, owned.id),
          eq(booking.status, 'confirmed'),
          eq(booking.origin, 'app'),
          sql`lower(${booking.period}) >= ${weekStart.toISOString()}::timestamptz`,
          sql`lower(${booking.period}) < ${weekEnd.toISOString()}::timestamptz`,
        ),
      );

    return ownerVenueSummarySchema.parse({
      occupancyPct,
      weekRevenueCents: Number(revenue?.cents ?? 0),
    });
  }

  /**
   * A confirmed booking made by the owner. Same transaction shape as the
   * player's hold: field row lock first (blocks, holds and manual bookings
   * all queue on it; the venue row is never locked here, so venue -> field is
   * not inverted), DB clock after the lock, same `validateBooking`.
   */
  async createManual(
    userId: string,
    fieldId: string,
    input: ManualBookingInput,
  ): Promise<AgendaBooking> {
    const owned = await findOwnedField(this.handle.db, fieldId, userId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + input.durationMinutes * MINUTE_MS,
    );
    let createdId: string;
    try {
      createdId = await this.handle.db.transaction(async (tx) => {
        const { target, now, result } = await validateUnderFieldLock(tx, {
          fieldId: owned.id,
          startsAt,
          durationMinutes: input.durationMinutes,
          audience: 'owner',
        });
        const [row] = await tx
          .insert(booking)
          .values({
            fieldId: target.id,
            // The field's own venue, from the locked row.
            venueId: target.venueId,
            userId: null,
            origin: 'manual',
            status: 'confirmed',
            period: { startsAt, endsAt },
            totalCents: result.totalCents,
            priceBreakdown: toPriceBreakdown(result.segments),
            confirmedAt: now,
            customerName: input.customerName,
            customerPhone: input.customerPhone ?? null,
          })
          .returning({ id: booking.id });
        if (!row) throw new Error('insert da reserva não retornou a linha');
        return row.id;
      });
    } catch (error) {
      // Safety net: the EXCLUDE constraint refused an overlap the check missed.
      if (hasPgCode(error, EXCLUSION_VIOLATION)) {
        throw new ConflictException(SLOT_TAKEN);
      }
      throw error;
    }
    return this.load(this.handle.db, createdId);
  }

  /**
   * The owner cancels a future booking of their own venue (held and alive, or
   * confirmed). Field row lock, then the booking row, like the player's paths.
   */
  async cancel(userId: string, bookingId: string): Promise<AgendaBooking> {
    if (!isUuid(bookingId)) throw new NotFoundException(BOOKING_NOT_FOUND);
    await this.handle.db.transaction(async (tx) => {
      const [own] = await tx
        .select({ fieldId: booking.fieldId })
        .from(booking)
        .innerJoin(venue, eq(venue.id, booking.venueId))
        .where(and(eq(booking.id, bookingId), eq(venue.ownerId, userId)))
        .limit(1);
      if (!own) throw new NotFoundException(BOOKING_NOT_FOUND);
      await tx
        .select({ id: field.id })
        .from(field)
        .where(eq(field.id, own.fieldId))
        .for('update');
      const [row] = await tx
        .select({
          status: booking.status,
          period: booking.period,
          holdExpiresAt: booking.holdExpiresAt,
        })
        .from(booking)
        .where(eq(booking.id, bookingId))
        .for('update');
      if (!row) throw new NotFoundException(BOOKING_NOT_FOUND);
      const now = await dbNow(tx);
      const upcoming = row.period.startsAt.getTime() > now.getTime();
      const alive =
        row.status === 'confirmed' ||
        (row.status === 'held' &&
          row.holdExpiresAt !== null &&
          row.holdExpiresAt > now);
      if (!upcoming || !alive) throw new ConflictException(CANNOT_CANCEL);
      await tx
        .update(booking)
        .set({ status: 'cancelled', cancelledAt: now, cancelledBy: 'owner' })
        .where(eq(booking.id, bookingId));
    });
    return this.load(this.handle.db, bookingId);
  }

  private async load(db: Pick<Db, 'select'> | Tx, id: string) {
    const [row] = await db
      .select(bookingColumns)
      .from(booking)
      .leftJoin(user, eq(user.id, booking.userId))
      .where(eq(booking.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(BOOKING_NOT_FOUND);
    return toItem(row);
  }
}
