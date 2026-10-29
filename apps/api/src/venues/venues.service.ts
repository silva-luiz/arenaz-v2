import {
  fieldSummarySchema,
  venueSchema,
  venueSummarySchema,
  type FieldSummary,
  type Venue,
  type VenueHours,
  type VenueInput,
  type VenueSummary,
  type VenueUpdate,
} from '@arenaz/contracts';
import {
  schema,
  type Field,
  type NewVenue,
  type VenuePhoto,
  type VenueHours as VenueHoursRow,
  type Venue as VenueRow,
} from '@arenaz/db';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { asc, count, desc, eq, or, sql } from 'drizzle-orm';
import { DB, type DbHandle } from '../db/db.module.js';
import {
  deleteQuietly,
  STORAGE,
  type StoragePort,
} from '../storage/storage.port.js';
import { findOwnedVenue, VENUE_NOT_FOUND } from './owner.js';
import {
  assertPublishedStaysComplete,
  lockVenueStatus,
  missingForPublish,
  PUBLISH_INCOMPLETE_MESSAGE,
} from './publishing.js';
import { slugify } from './slug.js';

const { venue, venueHours, venuePhoto, field, priceRule } = schema;

/**
 * Drizzle drops the table qualifier in single-table selects, which would make
 * `venue.id` inside a correlated subquery resolve to the inner table. Spell
 * the outer reference out.
 */
const OUTER_VENUE_ID = sql.raw('"venue"."id"');

/** Attempts at a unique slug when concurrent creates keep colliding. */
const SLUG_ATTEMPTS = 10;

// --------------------------------------------------------------- mapping ----

/** `numeric(5,1)` comes back from the driver as a string: number, or null. */
export function toMeters(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** DB field row (+ its price rule count) → the contract's `FieldSummary`. */
export function toFieldSummary(
  row: Field,
  priceRulesCount: number,
): FieldSummary {
  return fieldSummarySchema.parse({
    id: row.id,
    name: row.name,
    sports: row.sports,
    surface: row.surface,
    format: row.format,
    lengthM: toMeters(row.lengthM),
    widthM: toMeters(row.widthM),
    minSlotMinutes: row.minSlotMinutes,
    basePriceCentsPerHour: row.basePriceCentsPerHour,
    isActive: row.isActive,
    priceRulesCount,
  });
}

/**
 * DB rows → `Venue`, the one response mapper for owner venues. Hours are
 * sorted by weekday, photos by position (URLs from `photoUrl`, i.e. the
 * storage's public URL), timestamps are ISO strings, and the result is
 * validated with the contract schema before it leaves the API.
 */
export function toVenue(
  row: VenueRow,
  hours: VenueHoursRow[],
  photos: VenuePhoto[],
  fields: { field: Field; priceRulesCount: number }[],
  photoUrl: (storageKey: string) => string,
): Venue {
  return venueSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    phone: row.phone,
    address: {
      cep: row.cep,
      street: row.street,
      number: row.number,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
    },
    location: row.location,
    amenities: row.amenities,
    cancellationPolicy: row.cancellationPolicy,
    status: row.status,
    hours: hours
      .map(({ weekday, openMinute, closeMinute }) => ({
        weekday,
        openMinute,
        closeMinute,
      }))
      .sort((a, b) => a.weekday - b.weekday),
    photos: [...photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        url: photoUrl(photo.storageKey),
        position: photo.position,
      })),
    fields: fields.map((item) =>
      toFieldSummary(item.field, item.priceRulesCount),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** True for a Postgres unique violation (23505) on a constraint naming `column`. */
function isUniqueViolationOn(error: unknown, column: string): boolean {
  // Drizzle wraps the driver error and keeps it in `cause`.
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    const { code, constraint, cause } = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (code === '23505') {
      return typeof constraint === 'string' && constraint.includes(column);
    }
    current = cause;
  }
  return false;
}

// --------------------------------------------------------------- service ----

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async list(userId: string): Promise<VenueSummary[]> {
    const rows = await this.handle.db
      .select({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        status: venue.status,
        city: venue.city,
        fieldsCount: sql<number>`(select count(*)::int from ${field} where ${field.venueId} = ${OUTER_VENUE_ID})`,
        coverKey: sql<
          string | null
        >`(select ${venuePhoto.storageKey} from ${venuePhoto} where ${venuePhoto.venueId} = ${OUTER_VENUE_ID} order by ${venuePhoto.position}, ${venuePhoto.createdAt} limit 1)`,
      })
      .from(venue)
      .where(eq(venue.ownerId, userId))
      .orderBy(desc(venue.createdAt), asc(venue.id));
    return rows.map(({ coverKey, ...rest }) =>
      venueSummarySchema.parse({
        ...rest,
        coverUrl: coverKey === null ? null : this.storage.publicUrl(coverKey),
      }),
    );
  }

  async create(userId: string, input: VenueInput): Promise<Venue> {
    const { address } = input;
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const slug = await this.uniqueSlug(input.name);
      try {
        const [created] = await this.handle.db
          .insert(venue)
          .values({
            ownerId: userId,
            slug,
            name: input.name,
            description: input.description ?? null,
            phone: input.phone,
            cep: address.cep,
            street: address.street,
            number: address.number,
            complement: address.complement ?? null,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            location: input.location,
            amenities: input.amenities,
            cancellationPolicy: input.cancellationPolicy,
          })
          .returning({ id: venue.id });
        if (!created) throw new Error('insert do espaço não retornou a linha');
        return await this.load(created.id);
      } catch (error) {
        // Another request took the slug between our check and the insert.
        if (!isUniqueViolationOn(error, 'slug')) throw error;
      }
    }
    throw new ConflictException(
      'Não foi possível gerar um endereço único para o espaço. Tente novamente',
    );
  }

  async get(userId: string, venueId: string): Promise<Venue> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    return this.load(owned.id);
  }

  /** The slug never changes after creation, even when the name does. */
  async update(
    userId: string,
    venueId: string,
    input: VenueUpdate,
  ): Promise<Venue> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const changes: Partial<NewVenue> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.description !== undefined) {
      changes.description = input.description;
    }
    if (input.phone !== undefined) changes.phone = input.phone;
    if (input.address !== undefined) {
      const { address } = input;
      changes.cep = address.cep;
      changes.street = address.street;
      changes.number = address.number;
      changes.neighborhood = address.neighborhood;
      changes.city = address.city;
      changes.state = address.state;
      if (address.complement !== undefined) {
        changes.complement = address.complement;
      }
    }
    if (input.location !== undefined) changes.location = input.location;
    if (input.amenities !== undefined) changes.amenities = input.amenities;
    if (input.cancellationPolicy !== undefined) {
      changes.cancellationPolicy = input.cancellationPolicy;
    }

    if (Object.keys(changes).length > 0) {
      await this.handle.db
        .update(venue)
        .set({ ...changes, updatedAt: sql`now()` })
        .where(eq(venue.id, owned.id));
    }
    return this.load(owned.id);
  }

  /**
   * Deletes the venue (fields, hours and photo rows go with it, ON DELETE
   * CASCADE) and, once that is committed, its photo objects. The keys are read
   * under the venue lock, so a photo confirmed meanwhile is not missed; a
   * storage failure only leaves orphan objects and is logged.
   */
  async remove(userId: string, venueId: string): Promise<void> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const keys = await this.handle.db.transaction(async (tx) => {
      // A concurrent delete already removed it: same 404 as the other mutations.
      if ((await lockVenueStatus(tx, owned.id)) === undefined) {
        throw new NotFoundException(VENUE_NOT_FOUND);
      }
      const photos = await tx
        .select({ storageKey: venuePhoto.storageKey })
        .from(venuePhoto)
        .where(eq(venuePhoto.venueId, owned.id));
      await tx.delete(venue).where(eq(venue.id, owned.id));
      return photos.map((photo) => photo.storageKey);
    });
    await deleteQuietly(this.storage, keys, this.logger);
  }

  /** Replaces all opening hours at once, in a single transaction. */
  async replaceHours(
    userId: string,
    venueId: string,
    hours: VenueHours,
  ): Promise<Venue> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    await this.handle.db.transaction(async (tx) => {
      // Touching the venue first takes its row lock, so two concurrent
      // replacements run one after the other instead of colliding on the PK.
      await tx
        .update(venue)
        .set({ updatedAt: sql`now()` })
        .where(eq(venue.id, owned.id));
      await tx.delete(venueHours).where(eq(venueHours.venueId, owned.id));
      if (hours.length > 0) {
        await tx.insert(venueHours).values(
          hours.map((hour) => ({
            venueId: owned.id,
            weekday: hour.weekday,
            openMinute: hour.openMinute,
            closeMinute: hour.closeMinute,
          })),
        );
      }
      // Clearing the hours of a published venue is rejected (rolls back).
      await assertPublishedStaysComplete(tx, owned.id);
    });
    return this.load(owned.id);
  }

  /** Needs opening hours, an active field and a photo; says what is missing. */
  async publish(userId: string, venueId: string): Promise<Venue> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    await this.handle.db.transaction(async (tx) => {
      await lockVenueStatus(tx, owned.id);
      const errors = await missingForPublish(tx, owned.id);
      if (Object.keys(errors).length > 0) {
        throw new UnprocessableEntityException({
          message: PUBLISH_INCOMPLETE_MESSAGE,
          errors,
        });
      }
      await tx
        .update(venue)
        .set({ status: 'published', updatedAt: sql`now()` })
        .where(eq(venue.id, owned.id));
    });
    return this.load(owned.id);
  }

  async unpublish(userId: string, venueId: string): Promise<Venue> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    return this.setStatus(owned.id, 'draft');
  }

  /**
   * First free slug for `name`: the plain slug, then `-2`, `-3`... Two
   * concurrent calls can still pick the same one; `create` retries on the
   * unique constraint.
   */
  async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const rows = await this.handle.db
      .select({ slug: venue.slug })
      .from(venue)
      .where(
        // `base` only has [a-z0-9-], so it is safe inside a regex.
        or(eq(venue.slug, base), sql`${venue.slug} ~ ${`^${base}-[0-9]+$`}`),
      );
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${String(suffix)}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /**
   * The full `Venue` response for an id, with no ownership check: callers
   * (Tasks 4-5 too) must have verified it with `findOwnedVenue` already.
   */
  async load(venueId: string): Promise<Venue> {
    const { db } = this.handle;
    const [row] = await db.select().from(venue).where(eq(venue.id, venueId));
    if (!row) throw new NotFoundException(VENUE_NOT_FOUND);
    const [hours, photos, fields] = await Promise.all([
      db.select().from(venueHours).where(eq(venueHours.venueId, venueId)),
      db.select().from(venuePhoto).where(eq(venuePhoto.venueId, venueId)),
      db
        .select({
          field,
          priceRulesCount: count(priceRule.id),
        })
        .from(field)
        .leftJoin(priceRule, eq(priceRule.fieldId, field.id))
        .where(eq(field.venueId, venueId))
        .groupBy(field.id)
        .orderBy(asc(field.createdAt), asc(field.id)),
    ]);
    return toVenue(row, hours, photos, fields, (key) =>
      this.storage.publicUrl(key),
    );
  }

  private async setStatus(
    venueId: string,
    status: 'draft' | 'published',
  ): Promise<Venue> {
    await this.handle.db
      .update(venue)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(venue.id, venueId));
    return this.load(venueId);
  }
}
