import {
  PUBLIC_PAGE_SIZE,
  PUBLIC_SLUG_PATTERN,
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
import { VENUE_NOT_FOUND } from '../common/not-found.js';
import { DB, type DbHandle } from '../db/db.module.js';
import { photoUrls } from '../storage/photo-objects.js';
import { STORAGE, type StoragePort } from '../storage/storage.port.js';
import { loadNextFreeTimes, type NextFreeVenue } from './next-free.js';

const { venue, venueHours, venuePhoto, field, priceRule, user } = schema;

/** Fallback when the owner's account has no usable name. */
const HOST_FALLBACK_NAME = 'Dono';

/** What a search card needs, straight from the (single) card query. */
interface CardRow extends Record<string, unknown> {
  id: string;
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
  cover_widths: number[] | null;
  distance_m: number | null;
  timezone: string;
  /** Opening hours and active fields, for the next free time. */
  hours: NextFreeVenue['hours'];
  fields: NextFreeVenue['fields'];
  /** The database clock, read in the same statement. */
  now: Date | string;
}

/**
 * Cleans float noise off a point of the 0.01 degree grid (`approx_location`
 * is already snapped by the database; this only turns -23.560000000000002
 * into -23.56). The exact point never reaches this module.
 */
export function approximate({ lat, lng }: GeoPoint): GeoPoint {
  const round = (value: number): number => Math.round(value * 100) / 100;
  return { lat: round(lat), lng: round(lng) };
}

/** Escapes `\`, `%` and `_` so the term is matched literally by LIKE. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * First word of the owner's name; the rest of it stays private. A first word
 * that looks like an e-mail or has digits (a handle, not a name) is replaced.
 */
export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first === '' || /[@\d]/.test(first) ? HOST_FALLBACK_NAME : first;
}

/**
 * `lower(f_unaccent(column)) LIKE pattern`, accent and case insensitive on
 * both sides (lower() after unaccent only sees ASCII, so it does not depend on
 * the database locale). Same expression as the trigram indexes of migration 0005.
 */
function likeSearch(column: SQL, pattern: string): SQL {
  return sql`lower(f_unaccent(${column})) LIKE lower(f_unaccent(${pattern}::text)) ESCAPE '\\'`;
}

@Injectable()
export class PublicVenuesService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  /**
   * One set-based query: the published venues with at least one active
   * field, each with its lowest price (the cheapest of the base prices AND
   * the price rules of its active fields: that is what "a partir de" means),
   * the sports of its active fields and its cover photo (with its variants). Fetches one extra row to know `hasMore`.
   * Then ONE more query (`loadNextFreeTimes`) gives every card its next free time today.
   * Optional filters: `amenities` (the venue has all of them) and `maxPrice`
   * (reais; the "a partir de" price is at most that).
   *
   * Privacy: everything geographic (radius filter, ordering, distance, the
   * returned point) uses `approx_location`, never the exact `location`. Any
   * function of the exact point (a free radius, 0.1 km distances) could be
   * inverted to recover it.
   */
  async search(query: PublicSearchQuery): Promise<PublicSearchResponse> {
    const { q, sport, lat, lng, radiusKm, page, amenities, maxPrice } = query;
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
    if (amenities !== undefined) {
      // All of them (AND): the venue's list contains the requested ones.
      where.push(
        sql`v.amenities @> ARRAY[${sql.join(
          amenities.map((amenity) => sql`${amenity}::text`),
          sql`, `,
        )}]::text[]`,
      );
    }
    if (maxPrice !== undefined) {
      where.push(sql`fa.min_price <= ${maxPrice * 100}`);
    }
    if (point) {
      where.push(
        sql`ST_DWithin(v.approx_location, ${point}, ${radiusKm * 1000}::float8)`,
      );
    }

    let order: SQL;
    if (point) order = sql`ST_Distance(v.approx_location, ${point}), v.id`;
    else if (q !== undefined) order = sql`v.name, v.id`;
    else order = sql`v.created_at DESC, v.id`;

    const distance = point
      ? sql`ST_Distance(v.approx_location, ${point})`
      : sql`NULL::float8`;

    const { rows } = await this.handle.db.execute<CardRow>(sql`
      SELECT v.id, v.slug, v.name, v.neighborhood, v.city, v.state, v.timezone,
             ST_Y(v.approx_location::geometry) AS lat,
             ST_X(v.approx_location::geometry) AS lng,
             fa.min_price,
             fa.sports,
             cover.storage_key AS cover_key,
             cover.variant_widths AS cover_widths,
             ${distance} AS distance_m,
             (SELECT coalesce(jsonb_agg(jsonb_build_object(
                       'weekday', h.weekday,
                       'openMinute', h.open_minute,
                       'closeMinute', h.close_minute)), '[]'::jsonb)
                FROM venue_hours h
               WHERE h.venue_id = v.id) AS hours,
             (SELECT coalesce(jsonb_agg(jsonb_build_object(
                       'id', f3.id,
                       'minSlotMinutes', f3.min_slot_minutes)), '[]'::jsonb)
                FROM field f3
               WHERE f3.venue_id = v.id AND f3.is_active) AS fields,
             clock_timestamp() AS now
        FROM venue v
        CROSS JOIN LATERAL (
          SELECT (SELECT min(price.cents)
                    FROM (
                      SELECT f2.base_price_cents_per_hour AS cents
                        FROM field f2
                       WHERE f2.venue_id = v.id AND f2.is_active
                      UNION ALL
                      SELECT r.price_cents_per_hour
                        FROM price_rule r
                        JOIN field f2 ON f2.id = r.field_id
                       WHERE f2.venue_id = v.id AND f2.is_active
                    ) price) AS min_price,
                 array_agg(DISTINCT s.sport) AS sports
            FROM field f
            CROSS JOIN LATERAL unnest(f.sports) AS s(sport)
           WHERE f.venue_id = v.id AND f.is_active
        ) fa
        LEFT JOIN LATERAL (
          SELECT p.storage_key, p.variant_widths
            FROM venue_photo p
           WHERE p.venue_id = v.id
           ORDER BY p.position, p.created_at
           LIMIT 1
        ) cover ON true
       WHERE ${sql.join(where, sql` AND `)}
       ORDER BY ${order}
       LIMIT ${PUBLIC_PAGE_SIZE + 1} OFFSET ${(page - 1) * PUBLIC_PAGE_SIZE}
    `);

    const pageRows = rows.slice(0, PUBLIC_PAGE_SIZE);
    // The database clock (same one the booking paths use), and one busy query
    // for every field of the page.
    const nextFree =
      pageRows[0] === undefined
        ? new Map<string, string | null>()
        : await loadNextFreeTimes(
            this.handle.db,
            pageRows.map((row) => ({
              id: row.id,
              timezone: row.timezone,
              hours: row.hours,
              fields: row.fields,
            })),
            new Date(pageRows[0].now),
          );
    const items = pageRows.map((row) => {
      const cover =
        row.cover_key === null
          ? null
          : photoUrls(this.storage, row.cover_key, row.cover_widths);
      return publicVenueCardSchema.parse({
        slug: row.slug,
        name: row.name,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        coverUrl: cover?.url ?? null,
        coverSrcSet: cover?.srcSet ?? null,
        // Catalog order, whatever order the database returned.
        sports: SPORTS.filter((known) => row.sports.includes(known)),
        minPriceCentsPerHour: row.min_price,
        approxLocation: approximate({ lat: row.lat, lng: row.lng }),
        distanceKm:
          row.distance_m === null
            ? null
            : Math.round(row.distance_m / 100) / 10,
        nextFreeTime: nextFree.get(row.id) ?? null,
      });
    });
    return publicSearchResponseSchema.parse({
      items,
      page,
      pageSize: PUBLIC_PAGE_SIZE,
      hasMore: rows.length > PUBLIC_PAGE_SIZE,
    });
  }

  /** A published venue by slug; a draft or unknown slug is a plain 404. */
  async detail(slug: string): Promise<PublicVenue> {
    // Nothing else can exist (and NUL would be a database error).
    if (!PUBLIC_SLUG_PATTERN.test(slug)) {
      throw new NotFoundException(VENUE_NOT_FOUND);
    }
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
        location: selectLocation(venue.approxLocation),
        amenities: venue.amenities,
        cancellationPolicy: venue.cancellationPolicy,
        timezone: venue.timezone,
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
        .orderBy(asc(venueHours.weekday), asc(venueHours.openMinute)),
      db
        .select({
          id: venuePhoto.id,
          storageKey: venuePhoto.storageKey,
          variantWidths: venuePhoto.variantWidths,
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
      timezone: row.timezone,
      hours,
      photos: photos.map((photo) => ({
        id: photo.id,
        ...photoUrls(this.storage, photo.storageKey, photo.variantWidths),
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
