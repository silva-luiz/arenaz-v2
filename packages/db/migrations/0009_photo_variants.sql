-- Resized WebP variants of the photos, made by the worker. Existing photos
-- start pending (variant_widths NULL), so the worker backfills them.
ALTER TABLE "venue_photo" ADD COLUMN "variant_widths" smallint[];--> statement-breakpoint
ALTER TABLE "venue_photo" ADD COLUMN "variant_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "venue_photo_variants_pending_idx" ON "venue_photo" USING btree ("created_at") WHERE "venue_photo"."variant_widths" is null;