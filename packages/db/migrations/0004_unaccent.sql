CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- `unaccent(text)` is only STABLE (it reads the dictionary from the search
-- path), which indexes refuse. Pinning the dictionary by its qualified name
-- makes the result depend on the arguments alone, so the wrapper is IMMUTABLE.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
-- A btree (even with text_pattern_ops) cannot serve `LIKE '%term%'`; trigram
-- GIN indexes can. Same expression the public search filters on.
CREATE INDEX IF NOT EXISTS "venue_city_search_idx" ON "venue" USING gin (f_unaccent(lower("city")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_neighborhood_search_idx" ON "venue" USING gin (f_unaccent(lower("neighborhood")) gin_trgm_ops);
