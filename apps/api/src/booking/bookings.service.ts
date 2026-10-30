import {
  HOLD_MINUTES,
  MAX_ACTIVE_HOLDS,
  bookingSchema,
  photoVariantKey,
  type Booking,
  type CancelBookingResponse,
  type CreateBookingInput,
  type NextBookingResponse,
} from '@arenaz/contracts';
import { expireDueHolds, schema, type Db } from '@arenaz/db';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { dbNow } from '../common/db-clock.js';
import { EXCLUSION_VIOLATION, hasPgCode } from '../common/pg-errors.js';
import { DB, type DbHandle } from '../db/db.module.js';
import { STORAGE, type StoragePort } from '../storage/storage.port.js';
import { coverPhoto } from '../venues/cover-photo.js';
import { isUuid } from '../venues/owner.js';
import {
  ALREADY_PAID,
  BOOKING_NOT_FOUND,
  CANCELLED_HOLD,
  CANCELLED_PAID,
  CANCEL_TOO_LATE,
  CANNOT_CANCEL,
  CHARGE_NOT_FOUND,
  HOLD_EXPIRED,
  NOT_AWAITING_PAYMENT,
  SLOT_TAKEN,
  TOO_MANY_HOLDS,
} from './booking-errors.js';
import {
  lockField,
  toPriceBreakdown,
  validateUnderFieldLock,
} from './booking-context.js';
import { bookingCode, formatNextBookingWhen } from './next-booking.js';

const { booking, venue, venuePhoto, field } = schema;

/** Width of the cover variant the hero card asks for (2x its ~300px slot). */
const CARD_COVER_WIDTH = 800;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** A confirmed booking can be cancelled up to this long before it starts. */
const CANCEL_NOTICE_MS = 24 * HOUR_MS;
const LIST_LIMIT = 200;

/** What a player needs to pay for a held booking. */
export interface Chargeable {
  id: string;
  totalCents: number;
  holdExpiresAt: Date;
}

const viewColumns = {
  id: booking.id,
  status: booking.status,
  period: booking.period,
  totalCents: booking.totalCents,
  holdExpiresAt: booking.holdExpiresAt,
  venueSlug: venue.slug,
  venueName: venue.name,
  neighborhood: venue.neighborhood,
  city: venue.city,
  timezone: venue.timezone,
  street: venue.street,
  number: venue.number,
  complement: venue.complement,
  cep: venue.cep,
  phone: venue.phone,
  fieldId: field.id,
  fieldName: field.name,
};

const viewQuery = (db: Db) =>
  db
    .select(viewColumns)
    .from(booking)
    .innerJoin(venue, eq(venue.id, booking.venueId))
    .innerJoin(field, eq(field.id, booking.fieldId));

type ViewRow = Awaited<ReturnType<typeof viewQuery>>[number];

/** The player's view. A stale hold reads as expired before any cleanup ran. */
function toBooking(row: ViewRow, now: Date): Booking {
  const stale =
    row.status === 'held' &&
    row.holdExpiresAt !== null &&
    row.holdExpiresAt.getTime() <= now.getTime();
  // The column is plain text: narrow it to the contract's enum, no cast.
  const status = bookingSchema.shape.status.parse(
    stale ? 'expired' : row.status,
  );
  return bookingSchema.parse({
    id: row.id,
    status,
    startsAt: row.period.startsAt.toISOString(),
    endsAt: row.period.endsAt.toISOString(),
    totalCents: row.totalCents,
    holdExpiresAt:
      status === 'held' ? (row.holdExpiresAt?.toISOString() ?? null) : null,
    venue: {
      slug: row.venueSlug,
      name: row.venueName,
      neighborhood: row.neighborhood,
      city: row.city,
      timezone: row.timezone,
    },
    field: { id: row.fieldId, name: row.fieldName },
    // The exact address belongs to the owner of a confirmed booking only.
    address:
      status === 'confirmed'
        ? {
            street: row.street,
            number: row.number,
            complement: row.complement,
            cep: row.cep,
            phone: row.phone,
          }
        : null,
  });
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /**
   * Holds a slot for 10 minutes. Everything happens in one transaction that
   * first takes the player's hold lock and then the field row lock (so blocks,
   * manual bookings and these all queue on the same row); the price comes only
   * from the server's rules.
   */
  async create(userId: string, input: CreateBookingInput): Promise<Booking> {
    const startsAt = new Date(input.startsAt);
    let createdId: string;
    try {
      createdId = await this.handle.db.transaction(async (tx) => {
        // Serializes one player's holds so the limit of 3 cannot be raced
        // across fields. Always taken before the field lock.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-holds:${userId}`}, 0))`,
        );
        const { target, now, endsAt, result } = await validateUnderFieldLock(
          tx,
          {
            fieldId: input.fieldId,
            startsAt,
            durationMinutes: input.durationMinutes,
            audience: 'player',
          },
        );

        const [holds] = await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(booking)
          .where(
            and(
              eq(booking.userId, userId),
              eq(booking.status, 'held'),
              gt(booking.holdExpiresAt, now),
            ),
          );
        if ((holds?.total ?? 0) >= MAX_ACTIVE_HOLDS) {
          throw new UnprocessableEntityException(TOO_MANY_HOLDS);
        }

        const [row] = await tx
          .insert(booking)
          .values({
            fieldId: target.id,
            // Always the field's own venue (the composite FK would refuse any other).
            venueId: target.venueId,
            userId,
            origin: 'app',
            status: 'held',
            period: { startsAt, endsAt },
            totalCents: result.totalCents,
            priceBreakdown: toPriceBreakdown(result.segments),
            holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * MINUTE_MS),
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
    return this.get(userId, createdId);
  }

  /**
   * The player's bookings: upcoming first (soonest first), then past ones
   * (latest first). Only the 200 most recently created are read: enough for
   * the "minhas reservas" screen; pagination can come with a real need.
   */
  async listMine(userId: string): Promise<Booking[]> {
    const rows = await viewQuery(this.handle.db)
      .where(eq(booking.userId, userId))
      .orderBy(desc(booking.createdAt))
      .limit(LIST_LIMIT);
    // The database clock, the same one the writes use, decides what is stale.
    const now = await dbNow(this.handle.db);
    const list = rows.map((row) => toBooking(row, now));
    const time = (item: Booking): number => new Date(item.startsAt).getTime();
    const upcoming = list
      .filter((item) => time(item) >= now.getTime())
      .sort((a, b) => time(a) - time(b));
    const past = list
      .filter((item) => time(item) < now.getTime())
      .sort((a, b) => time(b) - time(a));
    return [...upcoming, ...past];
  }

  /**
   * The player's next confirmed booking that has not started yet, worded for
   * the home hero card, or `null`. Held bookings are not "confirmed" yet;
   * cancelled ones drop off. The database clock decides what has started.
   */
  async nextConfirmed(userId: string): Promise<NextBookingResponse> {
    const now = await dbNow(this.handle.db);
    const [row] = await this.handle.db
      .select({
        id: booking.id,
        period: booking.period,
        venueName: venue.name,
        venueSlug: venue.slug,
        timezone: venue.timezone,
        fieldName: field.name,
        coverKey: coverPhoto<string>(venuePhoto.storageKey),
        coverWidths: coverPhoto<number[]>(venuePhoto.variantWidths),
      })
      .from(booking)
      .innerJoin(venue, eq(venue.id, booking.venueId))
      .innerJoin(field, eq(field.id, booking.fieldId))
      .where(
        and(
          eq(booking.userId, userId),
          eq(booking.status, 'confirmed'),
          sql`lower(${booking.period}) > ${now.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(sql`lower(${booking.period})`)
      .limit(1);
    if (!row) return { booking: null };

    // The 800px variant when the worker made one, else the original.
    const coverUrl =
      row.coverKey === null
        ? null
        : row.coverWidths?.includes(CARD_COVER_WIDTH)
          ? this.storage.publicUrl(
              photoVariantKey(row.coverKey, CARD_COVER_WIDTH),
            )
          : this.storage.publicUrl(row.coverKey);
    return {
      booking: {
        bookingId: row.id,
        venueName: row.venueName,
        venueSlug: row.venueSlug,
        coverUrl,
        when: formatNextBookingWhen(
          row.period.startsAt,
          row.period.endsAt,
          row.fieldName,
          row.timezone,
          now,
        ),
        code: bookingCode(row.id),
      },
    };
  }

  /** Someone else's booking is a 404, never a 403. */
  async get(userId: string, bookingId: string): Promise<Booking> {
    if (!isUuid(bookingId)) throw new NotFoundException(BOOKING_NOT_FOUND);
    const [row] = await viewQuery(this.handle.db)
      .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException(BOOKING_NOT_FOUND);
    return toBooking(row, await dbNow(this.handle.db));
  }

  /**
   * The booking to charge: the player's own, still held and within its
   * deadline. This is a plain read (no lock), so the answer can be stale by the
   * time the charge exists; that is fine because `confirmPaid` re-checks the
   * deadline under the field lock before confirming anything.
   */
  async chargeable(userId: string, bookingId: string): Promise<Chargeable> {
    if (!isUuid(bookingId)) throw new NotFoundException(BOOKING_NOT_FOUND);
    const [row] = await this.handle.db
      .select({
        id: booking.id,
        status: booking.status,
        totalCents: booking.totalCents,
        holdExpiresAt: booking.holdExpiresAt,
      })
      .from(booking)
      .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException(BOOKING_NOT_FOUND);
    if (row.status === 'confirmed') throw new ConflictException(ALREADY_PAID);
    if (row.status !== 'held' || row.holdExpiresAt === null) {
      throw new ConflictException(
        row.status === 'expired' ? HOLD_EXPIRED : NOT_AWAITING_PAYMENT,
      );
    }
    if (
      row.holdExpiresAt.getTime() <= (await dbNow(this.handle.db)).getTime()
    ) {
      throw new ConflictException(HOLD_EXPIRED);
    }
    return {
      id: row.id,
      totalCents: row.totalCents,
      holdExpiresAt: row.holdExpiresAt,
    };
  }

  /**
   * The payment arrived: confirms the booking if its hold is still alive.
   * Takes the field lock like every other writer, so it cannot interleave
   * with a cancellation or with the hold being reclaimed. Idempotent.
   * Only the booking's own player can confirm it (anyone else gets the same
   * 404 as an unknown charge); this is the simulated provider only.
   */
  async confirmPaid(userId: string, bookingId: string): Promise<void> {
    if (!isUuid(bookingId)) throw new NotFoundException(CHARGE_NOT_FOUND);
    const outcome = await this.handle.db.transaction(
      async (tx): Promise<'confirmed' | 'expired' | 'closed'> => {
        const [own] = await tx
          .select({ fieldId: booking.fieldId, userId: booking.userId })
          .from(booking)
          .where(eq(booking.id, bookingId))
          .limit(1);
        if (!own || own.userId !== userId) {
          throw new NotFoundException(CHARGE_NOT_FOUND);
        }
        await lockField(tx, own.fieldId);
        const [row] = await tx
          .select({
            status: booking.status,
            holdExpiresAt: booking.holdExpiresAt,
          })
          .from(booking)
          .where(eq(booking.id, bookingId))
          .for('update');
        if (!row) throw new NotFoundException(CHARGE_NOT_FOUND);
        if (row.status === 'confirmed') return 'confirmed';
        if (row.status !== 'held') {
          return row.status === 'expired' ? 'expired' : 'closed';
        }
        const now = await dbNow(tx);
        if (row.holdExpiresAt === null || row.holdExpiresAt <= now) {
          await expireDueHolds(tx, { bookingId, cutoff: now });
          return 'expired';
        }
        await tx
          .update(booking)
          .set({ status: 'confirmed', confirmedAt: now, holdExpiresAt: null })
          .where(eq(booking.id, bookingId));
        return 'confirmed';
      },
    );
    if (outcome === 'expired') throw new ConflictException(HOLD_EXPIRED);
    if (outcome === 'closed') {
      throw new ConflictException(NOT_AWAITING_PAYMENT);
    }
  }

  async cancel(
    userId: string,
    bookingId: string,
  ): Promise<CancelBookingResponse> {
    if (!isUuid(bookingId)) throw new NotFoundException(BOOKING_NOT_FOUND);
    const message = await this.handle.db.transaction(async (tx) => {
      const [own] = await tx
        .select({ fieldId: booking.fieldId })
        .from(booking)
        .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))
        .limit(1);
      if (!own) throw new NotFoundException(BOOKING_NOT_FOUND);
      await lockField(tx, own.fieldId);
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

      let text: string;
      if (row.status === 'held') {
        // A hold past its deadline is already expired for everyone.
        if (row.holdExpiresAt === null || row.holdExpiresAt <= now) {
          throw new ConflictException(CANNOT_CANCEL);
        }
        text = CANCELLED_HOLD;
      } else if (row.status === 'confirmed') {
        if (row.period.startsAt.getTime() - now.getTime() < CANCEL_NOTICE_MS) {
          throw new ConflictException(CANCEL_TOO_LATE);
        }
        // The refund is the support's job until Plano 4.
        text = CANCELLED_PAID;
      } else {
        throw new ConflictException(CANNOT_CANCEL);
      }
      await tx
        .update(booking)
        .set({ status: 'cancelled', cancelledAt: now, cancelledBy: 'player' })
        .where(eq(booking.id, bookingId));
      return text;
    });
    return { message, booking: await this.get(userId, bookingId) };
  }
}
