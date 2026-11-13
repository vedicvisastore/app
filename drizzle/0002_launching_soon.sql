ALTER TABLE "products" ADD COLUMN "coming_soon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "launch_at" timestamp with time zone;