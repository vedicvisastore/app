import { asc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { festivalProducts, festivals } from "@/db/schema";
import { festivalState } from "@/lib/festival-status";
import { secondsUntilNext, sharedCached } from "./cache";
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

/**
 * Custom pages visible to shoppers right now (live), in admin order. Read on every page (menu), so cached in
 * memory and Redis until an admin change, or until a page is due to appear or disappear by its dates.
 */
export async function liveFestivals(db: DB): Promise<StoreFestival[]> {
  const r = await sharedCached(
    "store-festivals",
    {
      memoryMs: 30_000,
      ttl: (r) => secondsUntilNext([r.nextChange]),
      revive: (raw) => {
        const r = raw as { list: StoreFestival[]; nextChange: string | null };
        return {
          list: r.list.map((f) => ({
            ...f,
            festivalDate: f.festivalDate ? new Date(f.festivalDate) : null,
          })),
          nextChange: r.nextChange,
        };
      },
    },
    () => loadLiveFestivals(db),
  );
  return r.list;
}

async function loadLiveFestivals(db: DB) {
  const rows = await db
    .select()
    .from(festivals)
    .where(eq(festivals.active, true))
    .orderBy(asc(festivals.sortOrder), asc(festivals.festivalDate));
  const now = Date.now();
  const next = rows
    .flatMap((f) => [f.showFrom, f.showUntil])
    .filter((t): t is Date => !!t && new Date(t).getTime() > now)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  const live = rows.filter((f) => festivalState(f) === "live");
  const links = live.length
    ? await db
        .select()
        .from(festivalProducts)
        .where(
          inArray(
            festivalProducts.festivalId,
            live.map((f) => f.id),
          ),
        )
        .orderBy(asc(festivalProducts.sortOrder))
    : [];
  const list: StoreFestival[] = live.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    tagline: f.tagline,
    description: f.description,
    festivalDate: f.festivalDate,
    image: f.image,
    accent: f.accent,
    showInMenu: f.showInMenu,
    productIds: links
      .filter((l) => l.festivalId === f.id)
      .map((l) => l.productId),
  }));
  return { list, nextChange: next ? new Date(next).toISOString() : null };
}

export async function festivalPage(db: DB, slug: string) {
  const f = (await liveFestivals(db)).find((x) => x.slug === slug);
  if (!f) return null;
  const all = await listStoreProducts(db);
  const byId = new Map(all.map((p) => [p.id, p]));
  return {
    ...f,
    products: f.productIds
      .map((id) => byId.get(id))
      .filter((p) => p !== undefined),
  };
}
