/** Loads data/pincodes.json (India Post directory, via data.gov.in) into the pincode_geo table. Safe to re-run. */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { pincodeGeo } from "../src/db/schema";
import { scriptDb } from "./db";

async function main() {
  const { db } = await scriptDb();
  const data = JSON.parse(readFileSync("data/pincodes.json", "utf8")) as { rows: [string, number | null, number | null, string, string][] };
  const rows = data.rows.map(([pincode, lat, lng, district, state]) => ({ pincode, lat, lng, district, state }));
  for (let i = 0; i < rows.length; i += 1000) {
    await db
      .insert(pincodeGeo)
      .values(rows.slice(i, i + 1000))
      .onConflictDoUpdate({ target: pincodeGeo.pincode, set: { lat: sql`excluded.lat`, lng: sql`excluded.lng`, district: sql`excluded.district`, state: sql`excluded.state` } });
  }
  console.log(`✓ Loaded ${rows.length} pincodes`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
