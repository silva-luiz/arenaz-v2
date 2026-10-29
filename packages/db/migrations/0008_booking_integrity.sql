DROP INDEX "booking_user_created_idx";--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_id_venue_id_unique" UNIQUE("id","venue_id");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_field_venue_fk" FOREIGN KEY ("field_id","venue_id") REFERENCES "public"."field"("id","venue_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_user_created_idx" ON "booking" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_manual_customer_check" CHECK ("booking"."origin" <> 'manual' or ("booking"."customer_name" is not null and btrim("booking"."customer_name") <> ''));