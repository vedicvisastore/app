CREATE TABLE "pincode_geo" (
	"pincode" text PRIMARY KEY NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"district" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL
);
