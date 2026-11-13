import { readFileSync } from "node:fs";
import { eq, isNull, and } from "drizzle-orm";
import { scriptDb } from "./db";
import { categories, discounts, products, settings } from "../src/db/schema";
import { parseWorkbook } from "../src/lib/excel-import";
import { importSheet } from "../src/lib/excel-apply";
import { moveStock } from "../src/server/stock";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";

const COPY: Record<string, { tagline: string; description: string }> = {
  "Hari Bhakti Box": {
    tagline: "Your first step into daily japa",
    description:
      "A gentle starter set for anyone beginning a daily practice. Inside: a Neem jap mala and Sakshi mala for counting rounds, a Tulsi kanthi mala to wear, a japa bag to keep your beads clean, a counter, Gopi chandan for tilak, Itra, a sticker and a mini poster. Packed by hand with a greeting card.",
  },
  "Vrindavan Bhakti Box": {
    tagline: "Vrindavan's colours, packed in a box",
    description:
      "Our signature box, inspired by the lanes of Vrindavan. A Tulsi jap mala and kanthi mala, chandan and Gopi chandan with a tilak stamp, Itra, a pocket Bhagavad Gita, a peacock feather, keychain, brooch and a 5-print poster set, all inside our illustrated sky-blue keepsake box.",
  },
  "Jaga Bhakti Box": {
    tagline: "For the Jagannath devotee",
    description:
      "Everything for a complete daily sadhana with a Jagannath touch. Tulsi jap and kanthi mala, premium japa bag, perfume and Itra, a tilak kit with chandan and stamp, a mirror, the Bhagavad Gita, a keychain, brooch and a 7-print poster set.",
  },
  "Krishna Priya Bhakti Box": {
    tagline: "The complete gift for someone you love",
    description:
      "Our fullest box. Tulsi jap mala, kanthi mala, premium japa bag, perfume and Itra, a doll, a framed print, mirror, brooch, keychain, prashad, a 10-print poster set and the full tilak kit. Comes in the black keepsake box: made for gifting.",
  },
  "Kids Bhakti Kit (DIY)": {
    tagline: "Make it, colour it, learn the stories",
    description:
      "A hands-on kit for kids aged 5–12. A DIY craft kit and a painting book of Krishna leelas, plus their own Neem jap mala, Tulsi kanthi mala, a doll, sticker sheet, poster set and peacock feather. Screen-free and full of stories.",
  },
  "Japa Set A": { tagline: "Mala, bag and Sakshi mala", description: "The essentials for chanting: a Neem jap mala, a japa bag to carry it and a Sakshi mala to count your rounds." },
  "Japa Set B": { tagline: "Tulsi mala with counter", description: "A Tulsi jap mala in a japa bag with a Sakshi mala and a counter, for steady daily rounds." },
  "Japa Set C": { tagline: "The complete chanting kit", description: "Tulsi jap mala, premium japa bag, Sakshi mala and counter, ready for your daily rounds wherever you go." },
  "Shringar Kit A": { tagline: "Tilak essentials", description: "Tulsi kanthi mala, Gopi chandan and a tilak stamp: the simplest way to start wearing tilak every day." },
  "Shringar Kit B": { tagline: "Tilak, Itra and a brooch", description: "Kanthi mala, Gopi chandan, tilak stamp, Itra and a brooch for a festive look." },
  "Shringar Kit C": { tagline: "The full shringar set", description: "Kanthi mala, chandan and Gopi chandan with a tilak stamp, Itra, a brooch, mirror and peacock feather." },
};

const CATEGORY_COPY: Record<string, string> = {
  "japa-bags": "Hand-stitched bags that keep your mala clean and close.",
  "kanthi-mala": "Tulsi neck beads, worn as a sign of devotion.",
  "jap-mala": "108-bead malas for chanting your rounds.",
  "tilak-chandan": "Gopi chandan, chandan and tilak stamps.",
  "itra-fragrance": "Temple-style attar, alcohol-free.",
  books: "Scripture for daily reading.",
};

async function main() {
  const { db } = await scriptDb();
  const file = process.argv[2] ?? "data/VedicvisaStore.xlsx";
  const parsed = await parseWorkbook(readFileSync(file));
  const result = await importSheet(db, parsed);
  console.log("✓ Imported", result);

  for (const [name, c] of Object.entries(COPY)) {
    await db.update(products).set(c).where(and(eq(products.name, name), isNull(products.description)));
  }
  for (const [slug, description] of Object.entries(CATEGORY_COPY)) {
    await db.update(categories).set({ description }).where(and(eq(categories.slug, slug), isNull(categories.description)));
  }
  await db
    .update(products)
    .set({ images: ["/brand/vrindavan-box.jpg"], pinRank: 1 })
    .where(eq(products.name, "Vrindavan Bhakti Box"));
  // Opening stock for things customers can buy; packing/delivery stay untracked.
  const untracked = await db.select({ id: products.id }).from(products).where(and(eq(products.visibility, "public"), eq(products.kind, "single"), isNull(products.stock)));
  for (const p of untracked) await moveStock(db, { productId: p.id, delta: 40, reason: "opening", note: "Opening stock (seed)" });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }

  const existing = await db.select().from(discounts).limit(1);
  if (!existing.length) {
    await db.insert(discounts).values([
      { kind: "coupon", name: "Welcome offer", code: "JAISHRIKRISHNA", type: "percent", value: 10, maxDiscount: 30000, perUserLimit: 1 },
      { kind: "auto_cart", name: "₹150 off above ₹1,999", type: "flat", value: 15000, minSubtotal: 199900 },
    ]);
  }
  console.log("✓ Seed complete");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
