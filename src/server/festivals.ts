import { asc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { festivalProducts, festivals } from "@/db/schema";
import { festivalState } from "@/lib/festival-status";
import { cached } from "./cache";
import { listStoreProducts } from "./catalog";

export type StoreFestival = {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  festivalDate: Date | null;
  image: string | null;
  accent: string;
  showInMenu: boolean;
  productIds: number[];
};

/** Festivals visible to shoppers right now (live), in admin order. Cached like the catalogue. */
export function liveFestivals(db: DB): Promise<StoreFestival[]> {
  return cached("store-festivals", 30_000, async () => {
    const rows = await db.select().from(festivals).where(eq(festivals.active, true)).orderBy(asc(festivals.sortOrder), asc(festivals.festivalDate));
    const live = rows.filter((f) => festivalState(f) === "live");
    const links = live.length
      ? await db.select().from(festivalProducts).where(inArray(festivalProducts.festivalId, live.map((f) => f.id))).orderBy(asc(festivalProducts.sortOrder))
      : [];
    return live.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      tagline: f.tagline,
      description: f.description,
      festivalDate: f.festivalDate,
      image: f.image,
      accent: f.accent,
      showInMenu: f.showInMenu,
      productIds: links.filter((l) => l.festivalId === f.id).map((l) => l.productId),
    }));
  });
}

export async function festivalPage(db: DB, slug: string) {
  const f = (await liveFestivals(db)).find((x) => x.slug === slug);
  if (!f) return null;
  const all = await listStoreProducts(db);
  const byId = new Map(all.map((p) => [p.id, p]));
  return { ...f, products: f.productIds.map((id) => byId.get(id)).filter((p) => p !== undefined) };
}
