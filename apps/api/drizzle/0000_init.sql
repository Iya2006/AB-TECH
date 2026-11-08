CREATE TYPE "public"."quote_status" AS ENUM('nouveau', 'en_cours', 'traite');--> statement-breakpoint
CREATE TYPE "public"."service_domain" AS ENUM('print', 'tech');--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "quote_status" DEFAULT 'nouveau' NOT NULL,
	"full_name" text NOT NULL,
	"company" text,
	"phone" text NOT NULL,
	"email" text,
	"service" text NOT NULL,
	"quantity" integer,
	"message" text NOT NULL,
	"customization" jsonb,
	"mockup_url" text,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"domain" "service_domain" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_service_services_slug_fk" FOREIGN KEY ("service") REFERENCES "public"."services"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_requests_created_at_idx" ON "quote_requests" USING btree ("created_at");