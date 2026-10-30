-- The public API must never work on the exact point: filters, ordering and
-- distances computed on it can be inverted (binary search on the radius,
-- trilateration) to recover it. `approx_location` is the exact point snapped to
-- a 0.01 degree grid (about 1 km), kept in sync by the database itself.
-- (drizzle-kit quotes the type of an ADD COLUMN, which is invalid: unquoted here.)
ALTER TABLE "venue" ADD COLUMN IF NOT EXISTS "approx_location" geography(Point,4326) GENERATED ALWAYS AS (ST_SnapToGrid("location"::geometry, 0.01)::geography) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_approx_location_idx" ON "venue" USING gist ("approx_location");--> statement-breakpoint
-- Text search now reads lower(f_unaccent(x)): lower() runs on ASCII only, so it
-- no longer depends on the database locale. Recreate the indexes to match.
DROP INDEX IF EXISTS "venue_city_search_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "venue_neighborhood_search_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_city_search_idx" ON "venue" USING gin (lower(f_unaccent("city")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_neighborhood_search_idx" ON "venue" USING gin (lower(f_unaccent("neighborhood")) gin_trgm_ops);
