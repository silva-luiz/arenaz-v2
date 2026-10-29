import { z } from 'zod';
import {
  AMENITIES,
  CANCELLATION_POLICIES,
  SPORTS,
  type Amenity,
} from './catalog.js';
import { fieldSchema, priceRuleSchema } from './field.js';
import { locationSchema } from './geo.js';
import { photoSchema } from './photo.js';
import { timezoneSchema } from './timezone.js';
import { venueHoursSchema } from './venue.js';

export const PUBLIC_PAGE_SIZE = 20;
export const PUBLIC_MAX_PAGE = 50;
export const PUBLIC_MAX_RADIUS_KM = 50;
export const PUBLIC_DEFAULT_RADIUS_KM = 10;
/** What a venue slug can look like; anything else is a plain 404. */
export const PUBLIC_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

const LAT_LNG_TOGETHER_MESSAGE = 'Informe a latitude e a longitude juntas';

/**
 * A query-string number: arrives as text, so blank is refused (`Number('')` is
 * 0) and the value is coerced before `rules` run.
 */
function queryNumber(invalid: string, rules: z.ZodType<number, number>) {
  return z
    .string({ error: invalid })
    .trim()
    .min(1, invalid)
    .pipe(z.coerce.number({ error: invalid }))
    .pipe(rules);
}

/** C0/C1 control characters (NUL included): never valid in a search. */
function hasControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

/** Free text: trimmed, inner whitespace collapsed to a single space. */
const queryTextSchema = z
  .string({ error: 'Busca inválida' })
  .refine((raw) => !hasControlCharacter(raw), {
    error: 'A busca tem caracteres inválidos',
  })
  .transform((raw) => raw.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'A busca precisa ter pelo menos 2 caracteres')
      .max(80, 'A busca pode ter no máximo 80 caracteres'),
  );

/** Largest `maxPrice` accepted, in reais per hour. */
export const PUBLIC_MAX_PRICE_REAIS = 10_000;

const INVALID_AMENITY = 'Comodidade inválida';
const INVALID_MAX_PRICE = 'Preço máximo inválido';

/**
 * Comma separated AMENITIES values ("coberta,vestiario"), all required (AND).
 * Whitespace around an item is ignored; repeats collapse; a blank item, an
 * unknown value or a repeated query parameter is refused.
 */
const amenitiesQuerySchema = z
  .string({ error: INVALID_AMENITY })
  .transform((raw, ctx) => {
    const items = raw.split(',').map((item) => item.trim());
    const known = new Set<string>(AMENITIES);
    if (!items.every((item) => known.has(item))) {
      // One issue on `amenities` itself (not `amenities.0`), whichever item failed.
      ctx.addIssue({ code: 'custom', message: INVALID_AMENITY });
      return z.NEVER;
    }
    return [...new Set(items)] as Amenity[];
  });

/**
 * `GET /venues` query string (every value arrives as a string). `lat` and
 * `lng` go together; unknown parameters are ignored.
 */
export const publicSearchQuerySchema = z
  .object({
    q: queryTextSchema.optional(),
    sport: z.enum(SPORTS, { error: 'Esporte inválido' }).optional(),
    lat: queryNumber('Latitude inválida', locationSchema.shape.lat).optional(),
    lng: queryNumber('Longitude inválida', locationSchema.shape.lng).optional(),
    radiusKm: queryNumber(
      'Raio inválido',
      z
        .number()
        .int('O raio precisa ser um número inteiro de km')
        .min(1, 'O raio mínimo é 1 km')
        .max(
          PUBLIC_MAX_RADIUS_KM,
          `O raio máximo é ${String(PUBLIC_MAX_RADIUS_KM)} km`,
        ),
    ).default(PUBLIC_DEFAULT_RADIUS_KM),
    amenities: amenitiesQuerySchema.optional(),
    /** Whole reais per hour: keeps venues whose "a partir de" is at most this. */
    maxPrice: queryNumber(
      INVALID_MAX_PRICE,
      z
        .number()
        .int(INVALID_MAX_PRICE)
        .min(1, INVALID_MAX_PRICE)
        .max(PUBLIC_MAX_PRICE_REAIS, INVALID_MAX_PRICE),
    ).optional(),
    page: queryNumber(
      'Página inválida',
      z
        .number()
        .int('Página inválida')
        .min(1, 'Página inválida')
        .max(PUBLIC_MAX_PAGE, `A página máxima é ${String(PUBLIC_MAX_PAGE)}`),
    ).default(1),
  })
  .superRefine((query, ctx) => {
    if (query.lat !== undefined && query.lng === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: LAT_LNG_TOGETHER_MESSAGE,
        path: ['lng'],
      });
    }
    if (query.lng !== undefined && query.lat === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: LAT_LNG_TOGETHER_MESSAGE,
        path: ['lat'],
      });
    }
  });

/** Venue as a search result card. */
export const publicVenueCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  coverUrl: z.string().nullable(),
  sports: z.array(z.enum(SPORTS)),
  /**
   * Lowest price per hour among the ACTIVE fields: the base prices and every
   * price rule count ("a partir de").
   */
  minPriceCentsPerHour: z.number().int().positive(),
  /** Latitude and longitude rounded to 2 decimals (about 1 km). */
  approxLocation: locationSchema,
  /**
   * Km from the searched point to the venue's APPROXIMATE point (1 decimal);
   * `null` without `lat`/`lng`. Never derived from the exact location.
   */
  distanceKm: z.number().nonnegative().nullable(),
  /**
   * Start ("HH:MM", venue wall clock) of the first free slot from now to the
   * end of TODAY (the venue's local date) on any active field; `null` when
   * nothing is free today. Slots that start after midnight do not count.
   */
  nextFreeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
});

export const publicSearchResponseSchema = z.object({
  items: z.array(publicVenueCardSchema),
  page: z.number().int().positive(),
  pageSize: z.literal(PUBLIC_PAGE_SIZE),
  hasMore: z.boolean(),
});

/** An active field as the public sees it (no `isActive`, no blocks). */
export const publicFieldSchema = fieldSchema
  .pick({
    id: true,
    name: true,
    sports: true,
    surface: true,
    format: true,
    lengthM: true,
    widthM: true,
    minSlotMinutes: true,
    basePriceCentsPerHour: true,
  })
  .extend({ priceRules: z.array(priceRuleSchema.omit({ id: true })) });

/**
 * Published venue for anyone: no phone, street, number, complement, CEP,
 * exact coordinates or owner ids.
 */
export const publicVenueSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  approxLocation: locationSchema,
  amenities: z.array(z.enum(AMENITIES)),
  cancellationPolicy: z.enum(CANCELLATION_POLICIES),
  timezone: timezoneSchema,
  hours: venueHoursSchema,
  photos: z.array(photoSchema),
  host: z.object({ firstName: z.string() }),
  fields: z.array(publicFieldSchema),
});

export type PublicSearchQuery = z.infer<typeof publicSearchQuerySchema>;
export type PublicVenueCard = z.infer<typeof publicVenueCardSchema>;
export type PublicSearchResponse = z.infer<typeof publicSearchResponseSchema>;
export type PublicField = z.infer<typeof publicFieldSchema>;
export type PublicVenue = z.infer<typeof publicVenueSchema>;
