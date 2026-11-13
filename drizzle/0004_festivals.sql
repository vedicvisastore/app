CREATE TABLE "festival_products" (
	"festival_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "festival_products_festival_id_product_id_pk" PRIMARY KEY("festival_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"description" text,
	"festival_date" timestamp with time zone,
	"show_from" timestamp with time zone,
	"show_until" timestamp with time zone,
	"image" text,
	"accent" text DEFAULT 'gulal' NOT NULL,
	"show_in_menu" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "festivals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "festival_products" ADD CONSTRAINT "festival_products_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_products" ADD CONSTRAINT "festival_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;