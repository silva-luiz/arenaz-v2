import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TimeRange {
  /** Inclusive lower bound. */
  startsAt: Date;
  /** Exclusive upper bound (ranges are always half-open `[)`). */
  endsAt: Date;
}

const EWKB_SRID_FLAG = 0x20000000;
const EWKB_Z_FLAG = 0x80000000;
const EWKB_M_FLAG = 0x40000000;
const WKB_POINT = 1;

/**
 * Parses PostGIS' hex EWKB output for a 2D point (what the driver returns for
 * a `geography` column). Handles both byte orders and the optional SRID.
 */
export function parseEwkbPoint(hex: string): GeoPoint {
  const buf = Buffer.from(hex, 'hex');
  const little = buf.readUInt8(0) === 1;
  const u32 = (at: number): number =>
    little ? buf.readUInt32LE(at) : buf.readUInt32BE(at);
  const f64 = (at: number): number =>
    little ? buf.readDoubleLE(at) : buf.readDoubleBE(at);

  const type = u32(1);
  if (
    (type & 0xff) !== WKB_POINT ||
    (type & EWKB_Z_FLAG) !== 0 ||
    (type & EWKB_M_FLAG) !== 0
  ) {
    throw new Error(`geometria não suportada (esperava Point 2D): ${hex}`);
  }
  const offset = (type & EWKB_SRID_FLAG) !== 0 ? 9 : 5;
  return { lng: f64(offset), lat: f64(offset + 8) };
}

/**
 * PostGIS `geography(Point,4326)`.
 *
 * - Write: pass `{ lat, lng }`; it is converted to
 *   `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` (see `pointSql`).
 * - Read: a plain `db.select().from(venue)` parses the driver's hex EWKB into
 *   `{ lat, lng }`. `selectLocation(column)` does the same in SQL and is the
 *   way to read the point in partial selects and `returning({...})`.
 */
export const geographyPoint = customType<{
  data: GeoPoint;
  driverData: SQL | string;
}>({
  dataType: () => 'geography(Point,4326)',
  toDriver: (value) => pointSql(value),
  fromDriver: (value) => {
    if (typeof value !== 'string') {
      throw new Error('geography: valor inesperado vindo do driver');
    }
    return parseEwkbPoint(value);
  },
});

/**
 * Builds `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography`. Only the SQL
 * fragment is inlined; `lng` and `lat` are bound as query parameters.
 */
export function pointSql({ lat, lng }: GeoPoint): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** SELECT expression returning `{ lat, lng }` for a geography column. */
export function selectLocation(column: SQLWrapper): SQL<GeoPoint> {
  return sql<GeoPoint>`json_build_object('lat', ST_Y(${column}::geometry), 'lng', ST_X(${column}::geometry))`;
}

const TSTZ =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})(?::?(\d{2}))?$/;

function parseTimestamptz(text: string): Date {
  const [, day, time, hours, minutes] = TSTZ.exec(text) ?? [];
  if (!day || !time || !hours) {
    throw new Error(`timestamptz inválido: ${text}`);
  }
  const date = new Date(`${day}T${time}${hours}:${minutes ?? '00'}`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`timestamptz inválido: ${text}`);
  }
  return date;
}

/** Parses the text form of a bounded `tstzrange`, e.g. `["2026-11-01 10:00:00+00","2026-11-01 12:00:00+00")`. */
export function parseTstzrange(text: string): TimeRange {
  const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(text);
  if (!m?.[1] || !m[2]) {
    throw new Error(`tstzrange inválido (vazio ou sem limite): ${text}`);
  }
  return { startsAt: parseTimestamptz(m[1]), endsAt: parseTimestamptz(m[2]) };
}

/**
 * Postgres `tstzrange`, always half-open `[)`.
 *
 * - Write: pass `{ startsAt, endsAt }` (see `tstzrangeSql`).
 * - Read: a plain select parses the range text into `{ startsAt, endsAt }`
 *   (`Date`s); `selectPeriod(column)` does the same for partial selects.
 */
export const tstzrange = customType<{
  data: TimeRange;
  driverData: SQL | string;
}>({
  dataType: () => 'tstzrange',
  toDriver: (value) => tstzrangeSql(value.startsAt, value.endsAt),
  fromDriver: (value) => {
    if (typeof value !== 'string') {
      throw new Error('tstzrange: valor inesperado vindo do driver');
    }
    return parseTstzrange(value);
  },
});

/** `tstzrange(start, end, '[)')`: the end instant is exclusive. */
export function tstzrangeSql(startsAt: Date, endsAt: Date): SQL {
  return sql`tstzrange(${startsAt.toISOString()}::timestamptz, ${endsAt.toISOString()}::timestamptz, '[)')`;
}

interface PeriodJson {
  startsAt: string;
  endsAt: string;
}

/** SELECT expression returning `{ startsAt, endsAt }` (Dates) for a tstzrange column. */
export function selectPeriod(column: SQLWrapper): SQL<TimeRange> {
  return sql`json_build_object('startsAt', lower(${column}), 'endsAt', upper(${column}))`.mapWith(
    (value: PeriodJson): TimeRange => ({
      startsAt: new Date(value.startsAt),
      endsAt: new Date(value.endsAt),
    }),
  );
}
