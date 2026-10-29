import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * PostGIS `geography(Point,4326)`.
 *
 * Writes pass `pointSql({ lat, lng })` (Drizzle inlines SQL values, so the
 * point is built server-side by PostGIS); a plain `{ lat, lng }` is accepted
 * too and converted the same way. Reads must select `selectLocation(column)`:
 * selecting the raw column yields PostGIS' hex EWKB string.
 */
export const geographyPoint = customType<{
  data: SQL | GeoPoint;
  driverData: SQL | string;
}>({
  dataType: () => 'geography(Point,4326)',
  toDriver: (value) =>
    'lat' in value && 'lng' in value ? pointSql(value) : value,
});

/** Builds `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` for writes. */
export function pointSql({ lat, lng }: GeoPoint): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** SELECT expression returning `{ lat, lng }` for a geography column. */
export function selectLocation(column: SQLWrapper): SQL<GeoPoint> {
  return sql<GeoPoint>`json_build_object('lat', ST_Y(${column}::geometry), 'lng', ST_X(${column}::geometry))`;
}

/** Postgres `tstzrange`; always built through `tstzrangeSql` (half-open). */
export const tstzrange = customType<{
  data: SQL;
  driverData: SQL | string;
}>({
  dataType: () => 'tstzrange',
});

/** `tstzrange(start, end, '[)')`: the end instant is exclusive. */
export function tstzrangeSql(startsAt: Date, endsAt: Date): SQL {
  return sql`tstzrange(${startsAt.toISOString()}::timestamptz, ${endsAt.toISOString()}::timestamptz, '[)')`;
}
