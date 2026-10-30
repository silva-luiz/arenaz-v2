CREATE TABLE "venue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phone" text NOT NULL,
	"cep" text NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"complement" text,
	"neighborhood" text NOT NULL,
	"city" text NOT NULL,
	"state" char(2) NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"cancellation_policy" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_slug_unique" UNIQUE("slug"),
	CONSTRAINT "venue_cancellation_policy_check" CHECK ("venue"."cancellation_policy" in ('flexivel', 'moderada', 'rigida')),
	CONSTRAINT "venue_status_check" CHECK ("venue"."status" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "venue_hours" (
	"venue_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"open_minute" smallint NOT NULL,
	"close_minute" smallint NOT NULL,
	CONSTRAINT "venue_hours_venue_id_weekday_pk" PRIMARY KEY("venue_id","weekday"),
	CONSTRAINT "venue_hours_weekday_check" CHECK ("venue_hours"."weekday" between 0 and 6),
	CONSTRAINT "venue_hours_range_check" CHECK ("venue_hours"."open_minute" >= 0 and "venue_hours"."close_minute" <= 1440 and "venue_hours"."open_minute" < "venue_hours"."close_minute"),
	CONSTRAINT "venue_hours_step_check" CHECK ("venue_hours"."open_minute" % 30 = 0 and "venue_hours"."close_minute" % 30 = 0)
);
--> statement-breakpoint
CREATE TABLE "venue_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_photo_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "availability_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"period" "tstzrange" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_block_period_check" CHECK (not isempty("availability_block"."period"))
);
--> statement-breakpoint
CREATE TABLE "field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sports" text[] NOT NULL,
	"surface" text NOT NULL,
	"format" text,
	"length_m" numeric(5, 1),
	"width_m" numeric(5, 1),
	"min_slot_minutes" smallint NOT NULL,
	"base_price_cents_per_hour" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_sports_not_empty_check" CHECK (cardinality("field"."sports") > 0),
	CONSTRAINT "field_min_slot_minutes_check" CHECK ("field"."min_slot_minutes" in (30, 60, 90)),
	CONSTRAINT "field_base_price_check" CHECK ("field"."base_price_cents_per_hour" > 0)
);
--> statement-breakpoint
CREATE TABLE "price_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"weekdays" smallint[] NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"price_cents_per_hour" integer NOT NULL,
	"label" text,
	CONSTRAINT "price_rule_minutes_check" CHECK ("price_rule"."start_minute" < "price_rule"."end_minute"),
	CONSTRAINT "price_rule_price_check" CHECK ("price_rule"."price_cents_per_hour" > 0)
);
--> statement-breakpoint
ALTER TABLE "venue" ADD CONSTRAINT "venue_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_hours" ADD CONSTRAINT "venue_hours_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_photo" ADD CONSTRAINT "venue_photo_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_block" ADD CONSTRAINT "availability_block_field_id_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rule" ADD CONSTRAINT "price_rule_field_id_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_owner_id_idx" ON "venue" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "venue_location_idx" ON "venue" USING gist ("location");--> statement-breakpoint
CREATE INDEX "venue_photo_venue_id_idx" ON "venue_photo" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "availability_block_field_id_idx" ON "availability_block" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "availability_block_period_idx" ON "availability_block" USING gist ("period");--> statement-breakpoint
CREATE INDEX "field_venue_id_idx" ON "field" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "price_rule_field_id_idx" ON "price_rule" USING btree ("field_id");