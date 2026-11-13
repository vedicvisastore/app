/** Applies a parsed product sheet to the database (server-only). */
import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { bundleItems, categories, products } from "@/db/schema";
import type { ParsedSheet } from "./excel-import";
import { slugify, toPaise } from "./utils";

/** Categories whose items are packing/delivery components, not sold on their own. */
export const INTERNAL_CATEGORIES = [
  "inner", "filling", "outer", "outer sticker", "outer main cover", "packing", "delivery",
];

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").trim().replace(/\b\w/g, (m) => m.toUpperCase());

export type ImportResult = {
  productsCreated: number;
  productsUpdated: number;
  bundlesCreated: number;
  bundlesUpdated: number;
  warnings: string[];
};

async function uniqueValue(db: DB, col: "sku" | "slug", base: string, selfId?: number) {
  let candidate = base;
  for (let i = 2; ; i++) {
    const found = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(col === "sku" ? products.sku : products.slug, candidate))
      .limit(1);
    if (!found.length || found[0].id === selfId) return candidate;
    candidate = `${base}-${i}`;
  }
}

export async function importSheet(db: DB, parsed: ParsedSheet): Promise<ImportResult> {
  const res: ImportResult = { productsCreated: 0, productsUpdated: 0, bundlesCreated: 0, bundlesUpdated: 0, warnings: [...parsed.warnings] };

  const catIds = new Map<string, number>();
  async function categoryId(name: string) {
    const key = name.toLowerCase();
    if (catIds.has(key)) return catIds.get(key)!;
    const slug = slugify(name);
    const existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    const id = existing[0]?.id ?? (await db.insert(categories).values({ name: titleCase(name).replace(/ & /g, " & "), slug }).returning())[0].id;
    catIds.set(key, id);
    return id;
  }

  const byName = async (name: string) =>
    (await db.select().from(products).where(sql`lower(trim(${products.name})) = ${name.trim().toLowerCase()}`).limit(1))[0];

  const idByName = new Map<string, number>();
  for (const p of parsed.products) {
    const internal = INTERNAL_CATEGORIES.includes(p.category.toLowerCase());
    const catId = internal ? null : await categoryId(p.category);
    const existing = await byName(p.name);
    if (existing) {
      await db
        .update(products)
        .set({ cost: toPaise(p.cost), price: toPaise(p.price), categoryId: catId ?? existing.categoryId, updatedAt: new Date() })
        .where(eq(products.id, existing.id));
      idByName.set(p.name.toLowerCase(), existing.id);
      res.productsUpdated++;
    } else {
      const sku = await uniqueValue(db, "sku", p.sku.trim().toUpperCase().replace(/\s+/g, "-"));
      if (sku !== p.sku.trim().toUpperCase()) res.warnings.push(`SKU "${p.sku}" is used more than once; "${p.name}" saved as ${sku}.`);
      const [row] = await db
        .insert(products)
        .values({
          sku,
          name: p.name.trim(),
          slug: await uniqueValue(db, "slug", slugify(p.name)),
          categoryId: catId,
          cost: toPaise(p.cost),
          price: toPaise(p.price),
          visibility: internal ? "internal" : "public",
        })
        .returning();
      idByName.set(p.name.toLowerCase(), row.id);
      res.productsCreated++;
    }
  }

  const bundleCat = await categoryId("Bhakti Boxes & Kits");
  for (const b of parsed.bundles) {
    const componentIds = b.items.map((n) => idByName.get(n.toLowerCase())).filter((x): x is number => !!x);
    const comps = componentIds.length
      ? await db.select().from(products).where(sql`${products.id} in (${sql.join(componentIds, sql`, `)})`)
      : [];
    const cost = comps.reduce((s, c) => s + c.cost, 0);
    const price = b.price !== null ? toPaise(b.price) : comps.reduce((s, c) => s + c.price, 0);
    const mrp = b.mrp !== null && b.mrp > (b.price ?? 0) ? toPaise(b.mrp) : null;
    const existing = await byName(b.name);
    let id: number;
    if (existing) {
      await db.update(products).set({ price, mrp, cost, bundleGroup: b.group, kind: "bundle", updatedAt: new Date() }).where(eq(products.id, existing.id));
      id = existing.id;
      res.bundlesUpdated++;
    } else {
      const base = "VV-" + b.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const [row] = await db
        .insert(products)
        .values({
          sku: await uniqueValue(db, "sku", base),
          name: b.name,
          slug: await uniqueValue(db, "slug", slugify(b.name)),
          kind: "bundle",
          bundleGroup: b.group,
          categoryId: bundleCat,
          price,
          mrp,
          cost,
          featured: b.group === "Bhakti Boxes",
        })
        .returning();
      id = row.id;
      res.bundlesCreated++;
    }
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
    if (componentIds.length) await db.insert(bundleItems).values(componentIds.map((pid) => ({ bundleId: id, productId: pid, qty: 1 })));
  }
  return res;
}
