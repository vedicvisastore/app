/**
 * DEV ONLY: adds sample paid orders spread across India so the analytics map has something to show.
 *   npm run demo:orders           add 300 sample orders (numbers start with DEMO-)
 *   npm run demo:orders -- --remove   delete them again
 * Never run against the production database.
 */
import { like } from "drizzle-orm";
import { orders } from "../src/db/schema";
import { scriptDb } from "./db";

const CITIES: [string, string, string, number][] = [
  ["110001", "New Delhi", "Delhi", 40], ["400001", "Mumbai", "Maharashtra", 38], ["560001", "Bengaluru", "Karnataka", 30],
  ["281121", "Vrindavan", "Uttar Pradesh", 28], ["700001", "Kolkata", "West Bengal", 18], ["500001", "Hyderabad", "Telangana", 16],
  ["600001", "Chennai", "Tamil Nadu", 14], ["411001", "Pune", "Maharashtra", 14], ["380001", "Ahmedabad", "Gujarat", 12],
  ["302001", "Jaipur", "Rajasthan", 12], ["226001", "Lucknow", "Uttar Pradesh", 10], ["751001", "Bhubaneswar", "Odisha", 9],
  ["752001", "Puri", "Odisha", 9], ["160017", "Chandigarh", "Chandigarh", 7], ["462001", "Bhopal", "Madhya Pradesh", 6],
  ["781001", "Guwahati", "Assam", 5], ["682001", "Kochi", "Kerala", 5], ["800001", "Patna", "Bihar", 5],
  ["248001", "Dehradun", "Uttarakhand", 4], ["403001", "Panaji", "Goa", 3], ["831001", "Jamshedpur", "Jharkhand", 3],
  ["190001", "Srinagar", "Jammu And Kashmir", 2], ["737101", "Gangtok", "Sikkim", 1],
];

async function main() {
  const { db } = await scriptDb();
  if (process.argv.includes("--remove")) {
    const del = await db.delete(orders).where(like(orders.number, "DEMO-%")).returning({ id: orders.id });
    console.log(`✓ Removed ${del.length} sample orders`);
    process.exit(0);
  }
  let n = 0;
  for (const [pincode, city, state, weight] of CITIES) {
    for (let i = 0; i < weight; i++) {
      const total = [80000, 150000, 240000, 310000, 30000, 55000][(n + i) % 6];
      const paidAt = new Date(Date.now() - Math.random() * 80 * 864e5);
      await db.insert(orders).values({
        number: `DEMO-${String(++n).padStart(4, "0")}`,
        email: "demo@vedicvisa.test",
        status: "delivered",
        subtotal: total,
        total,
        shippingAddress: { name: "Sample customer", phone: "9000000000", line1: "Sample address", city, state, pincode },
        paidAt,
        createdAt: paidAt,
      });
    }
  }
  console.log(`✓ Added ${n} sample orders (remove with --remove)`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
