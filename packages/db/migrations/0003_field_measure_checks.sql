-- Rows saved before this migration may hold 0.0 (a measure such as 0.04 was
-- rounded by numeric(5,1)); clear them so the CHECKs below can be added.
UPDATE "field" SET "length_m" = NULL WHERE "length_m" <= 0;--> statement-breakpoint
UPDATE "field" SET "width_m" = NULL WHERE "width_m" <= 0;--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_length_m_check" CHECK ("field"."length_m" > 0);--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_width_m_check" CHECK ("field"."width_m" > 0);
