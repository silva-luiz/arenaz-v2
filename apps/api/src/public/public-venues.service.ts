import {
  PUBLIC_PAGE_SIZE,
  publicSearchResponseSchema,
  publicVenueCardSchema,
  publicVenueSchema,
  SPORTS,
  type PublicSearchQuery,
  type PublicSearchResponse,
  type PublicVenue,
} from '@arenaz/contracts';
import { schema, selectLocation, type GeoPoint } from '@arenaz/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { DB, type DbHandle } from '../db/db.module.js';
import { STORAGE, type StoragePort } from '../storage/storage.port.js';
import { VENUE_NOT_FOUND } from '../venues/owner.js';

const { venue, venueHours, venuePhoto, field, priceRule, user } = schema;

/** Fallback when the owner's account has no usable name. */
const HOST_FALLBACK_NAME = 'Anfitrião';

/** What a search card needs, straight from the (single) card query. */
interface CardRow extends Record<string, unknown> {
  slug: string;
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  min_price: number;
  sports: string[];
  cover_key: string | null;
  distance_m: number | null;
}

/** About 1 km: the public map never shows the exact point. */
export function approximate({ lat, lng }: GeoPoint): GeoPoint {
  const round = (value: number): number => Math.round(value * 100) / 100;
  return { lat: round(lat), lng: round(lng) };
}

/** Escapes `\`, `%` and `_` so the term is matched literally by LIKE. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** First word of the owner's name; the rest of it stays private. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || HOST_FALLBACK_NAME;
}

/**
 * `f_unaccent(lower(column)) LIKE pattern`, accent and case insensitive on
 * both sides. Same expression as the trigram indexes of migration 0004.
 */
function likeSearch(column: SQL, pattern: string): SQL {
  return sql`f_unaccent(lower(${column})) LIKE f_unaccent(lower(${pattern}::text)) ESCAPE '\\'`;
}

@Injectable()
export class PublicVenuesService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /**
   * One set-based query: the published venues with at least one active
   * field, each with its cheapest active field, the sports of its active
   * fields and its cover photo. Fetches one extra row to know `hasMore`.
   */
  async search(query: PublicSearchQuery): Promise<PublicSearchResponse> {
    const { q, sport, lat, lng, radiusKm, page } = query;
    const point =
      lat !== undefined && lng !== undefined
        ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
        : null;

    const where: SQL[] = [
      sql`v.status = 'published'`,
      sql`fa.min_price IS NOT NULL`,
    ];
    if (sport !== undefined) where.push(sql`${sport}::text = ANY(fa.sports)`);
    if (q !== undefined) {
      const pattern = `%${escapeLike(q)}%`;
      where.push(
        sql`(${likeSearch(sql`v.city`, pattern)} OR ${likeSearch(sql`v.neighborhood`, pattern)})`,
      );
    }
    if (point) {
      where.push(
        sql`ST_DWithin(v.location, ${point}, ${radiusKm * 1000}::float8)`,
      );
    }

    let order: SQL;
    if (point) order = sql`ST_Distance(v.location, ${point}), v.id`;
    else if (q !== undefined) order = sql`v.name, v.id`;
    else order = sql`v.created_at DESC, v.id`;

    const distance = point
      ? sql`ST_Distance(v.location, ${point})`
      : sql`NULL::float8`;

    const { rows } = await this.handle.db.execute<CardRow>(sql`
      SELECT v.slug, v.name, v.neighborhood, v.city, v.state,
             ST_Y(v.location::geometry) AS lat,
             ST_X(v.location::geometry) AS lng,
             fa.min_price,
             fa.sports,
             (SELECT p.storage_key FROM venue_photo p
               WHERE p.venue_id = v.id
               ORDER BY p.position, p.created_at
               LIMIT 1) AS cover_key,
             ${distance} AS distance_m
        FROM venue v
        CROSS JOIN LATERAL (
          SELECT min(f.base_price_cents_per_hour) AS min_price,
                 array_agg(DISTINCT s.sport) AS sports
            FROM field f
            CROSS JOIN LATERAL unnest(f.sports) AS s(sport)
           WHERE f.venue_id = v.id AND f.is_active
        ) fa
       WHERE ${sql.join(where, sql` AND `)}
       ORDER BY ${order}
       LIMIT ${PUBLIC_PAGE_SIZE + 1} OFFSET ${(page - 1) * PUBLIC_PAGE_SIZE}
    `);

    const items = rows.slice(0, PUBLIC_PAGE_SIZE).map((row) =>
      publicVenueCardSchema.parse({
        slug: row.slug,
        name: row.name,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        coverUrl:
          row.cover_key === null ? null : this.storage.publicUrl(row.cover_key),
        // Catalog order, whatever order the database returned.
        sports: SPORTS.filter((known) => row.sports.includes(known)),
        minPriceCentsPerHour: row.min_price,
        approxLocation: approximate({ lat: row.lat, lng: row.lng }),
        distanceKm:
          row.distance_m === null
            ? null
            : Math.round(row.distance_m / 100) / 10,
      }),
    );
    return publicSearchResponseSchema.parse({
      items,
      page,
      pageSize: PUBLIC_PAGE_SIZE,
      hasMore: rows.length > PUBLIC_PAGE_SIZE,
    });
  }

  /** A published venue by slug; a draft or unknown slug is a plain 404. */
  async detail(slug: string): Promise<PublicVenue> {
    const { db } = this.handle;
    const [row] = await db
      .select({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        description: venue.description,
        neighborhood: venue.neighborhood,
        city: venue.city,
        state: venue.state,
        location: selectLocation(venue.location),
        amenities: venue.amenities,
        cancellationPolicy: venue.cancellationPolicy,
        hostName: user.name,
      })
      .from(venue)
      .innerJoin(user, eq(venue.ownerId, user.id))
      .where(and(eq(venue.slug, slug), eq(venue.status, 'published')))
      .limit(1);
    if (!row) throw new NotFoundException(VENUE_NOT_FOUND);

    const [hours, photos, fields] = await Promise.all([
      db
        .select({
          weekday: venueHours.weekday,
          openMinute: venueHours.openMinute,
          closeMinute: venueHours.closeMinute,
        })
        .from(venueHours)
        .where(eq(venueHours.venueId, row.id))
        .orderBy(asc(venueHours.weekday)),
      db
        .select({
          id: venuePhoto.id,
          storageKey: venuePhoto.storageKey,
          position: venuePhoto.position,
        })
        .from(venuePhoto)
        .where(eq(venuePhoto.venueId, row.id))
        .orderBy(asc(venuePhoto.position), asc(venuePhoto.createdAt)),
      db
        .select()
        .from(field)
        .where(and(eq(field.venueId, row.id), eq(field.isActive, true)))
        .orderBy(asc(field.createdAt), asc(field.id)),
    ]);
    const rules =
      fields.length === 0
        ? []
        : await db
            .select()
            .from(priceRule)
            .where(
              inArray(
                priceRule.fieldId,
                fields.map((item) => item.id),
              ),
            )
            .orderBy(asc(priceRule.startMinute), asc(priceRule.id));

    return publicVenueSchema.parse({
      slug: row.slug,
      name: row.name,
      description: row.description,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      approxLocation: approximate(row.location),
      amenities: row.amenities,
      cancellationPolicy: row.cancellationPolicy,
      hours,
      photos: photos.map((photo) => ({
        id: photo.id,
        url: this.storage.publicUrl(photo.storageKey),
        position: photo.position,
      })),
      host: { firstName: firstNameOf(row.hostName) },
      fields: fields.map((item) => ({
        id: item.id,
        name: item.name,
        sports: item.sports,
        surface: item.surface,
        format: item.format,
        lengthM: item.lengthM === null ? null : Number(item.lengthM),
        widthM: item.widthM === null ? null : Number(item.widthM),
        minSlotMinutes: item.minSlotMinutes,
        basePriceCentsPerHour: item.basePriceCentsPerHour,
        priceRules: rules
          .filter((rule) => rule.fieldId === item.id)
          .map((rule) => ({
            weekdays: rule.weekdays,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
            priceCentsPerHour: rule.priceCentsPerHour,
            label: rule.label,
          })),
      })),
    });
  }
}
