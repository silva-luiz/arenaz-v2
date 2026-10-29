CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"user_id" text,
	"origin" text NOT NULL,
	"status" text NOT NULL,
	"period" "tstzrange" NOT NULL,
	"total_cents" integer NOT NULL,
	"price_breakdown" jsonb NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"customer_name" text,
	"customer_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	CONSTRAINT "booking_origin_check" CHECK ("booking"."origin" in ('app', 'manual')),
	CONSTRAINT "booking_status_check" CHECK ("booking"."status" in ('held', 'confirmed', 'cancelled', 'expired')),
	CONSTRAINT "booking_cancelled_by_check" CHECK ("booking"."cancelled_by" in ('player', 'owner', 'system')),
	CONSTRAINT "booking_total_check" CHECK ("booking"."total_cents" > 0),
	CONSTRAINT "booking_period_check" CHECK (not isempty("booking"."period") and lower_inc("booking"."period") and not upper_inc("booking"."period") and not lower_inf("booking"."period") and not upper_inf("booking"."period")),
	CONSTRAINT "booking_hold_check" CHECK ("booking"."status" <> 'held' or "booking"."hold_expires_at" is not null)
);
ALTER TABLE "booking" ADD CONSTRAINT "booking_field_id_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_venue_period_idx" ON "booking" USING btree ("venue_id",lower("period"));--> statement-breakpoint
CREATE INDEX "booking_user_created_idx" ON "booking" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "booking_hold_expires_idx" ON "booking" USING btree ("hold_expires_at") WHERE "booking"."status" = 'held';--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_no_overlap" EXCLUDE USING gist ("field_id" WITH =, "period" WITH &&) WHERE ("status" IN ('held', 'confirmed'));
