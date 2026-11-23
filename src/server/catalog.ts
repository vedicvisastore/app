import { searchProducts } from "@/lib/search";
import { discountState } from "@/lib/discount-status";
import { nsKey, secondsUntilNext, sharedCached } from "./cache";
import { redisEnabled, redisPipeline } from "./redis";

/** JSON (Redis) turns Dates into strings: turn the named fields back into Dates. */
function dates<T>(o: T, keys: string[]): T {
  const r = o as Record<string, unknown>;
  for (const k of keys) if (typeof r[k] === "string") r[k] = new Date(r[k] as string);
  return o;
}
const DISCOUNT_DATES = ["startsAt", "endsAt", "createdAt", "updatedAt"];
import { and, desc, eq, gt, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { bundleItems, categories, discounts, orderItems, orders, products, type Discount, type Product } from "@/db/schema";

/** Upcoming = tagged "launching soon" and its launch time (if any) hasn't passed yet. */
export function isUpcoming(p: { comingSoon: boolean; launchAt: Date | null }, now = new Date()) {
  return p.comingSoon && (!p.launchAt || p.launchAt > now);
}

export function isDiscountLive(d: Discount, now = new Date()) {
  return discountState(d, now) === "live";
}

export function discountApplies(d: Pick<Discount, "productIds" | "categoryIds">, p: Pick<Product, "id" | "categoryId">) {
  if (!d.productIds.length && !d.categoryIds.length) return true;
  return d.productIds.includes(p.id) || (p.categoryId != null && d.categoryIds.includes(p.categoryId));
}

/** Live sales/offers/coupons plus when the next one starts or ends (the cache must not outlive that moment). */
function discountInfo(db: DB) {
  return sharedCached(
    "discounts",
    {
      memoryMs: 15_000,
      ttl: (i) => secondsUntilNext([i.nextChange]),
      revive: (raw) => {
        const i = raw as { live: Discount[]; nextChange: string | null };
        return { live: i.live.map((d) => dates(d, DISCOUNT_DATES)), nextChange: i.nextChange };
      },
    },
    async () => {
      const rows = await db.select().from(discounts).where(eq(discounts.active, true));
      const now = Date.now();
      const upcoming = rows.flatMap((d) => [d.startsAt, d.endsAt]).filter((t): t is Date => !!t && t.getTime() > now);
      const next = upcoming.sort((a, b) => a.getTime() - b.getTime())[0];
      return { live: rows.filter((d) => isDiscountLive(d)), nextChange: next ? next.toISOString() : null };
    },
  );
}

export async function liveDiscounts(db: DB) {
  return (await discountInfo(db)).live;
}

/** Best live "sale" for a product → selling price, plus the price to strike through. */
export function effectivePrice(p: Pick<Product, "id" | "categoryId" | "price" | "mrp">, sales: Discount[]) {
  let best = p.price;
  let label: string | null = null;
  for (const s of sales) {
    if (s.kind !== "sale" || !discountApplies(s, p)) continue;
    let v = p.price;
    if (s.type === "percent") v = Math.round((p.price * (100 - s.value)) / 100 / 100) * 100;
    else if (s.type === "flat") v = p.price - s.value;
    v = Math.max(100, v);
    if (v < best) {
      best = v;
      label = s.name;
    }
  }
  const strike = Math.max(p.mrp ?? 0, best < p.price ? p.price : 0) || null;
  return { price: best, mrp: strike && strike > best ? strike : null, saleLabel: label };
}

/** Units available. null = unlimited. Bundles are limited by their tracked components. */
export async function availability(db: DB, list: Pick<Product, "id" | "kind" | "stock">[]) {
  const out = new Map<number, number | null>();
  const bundleIds = list.filter((p) => p.kind === "bundle").map((p) => p.id);
  const comps = bundleIds.length
    ? await db
        .select({ bundleId: bundleItems.bundleId, qty: bundleItems.qty, stock: products.stock })
        .from(bundleItems)
        .innerJoin(products, eq(products.id, bundleItems.productId))
        .where(inArray(bundleItems.bundleId, bundleIds))
    : [];
  for (const p of list) {
    let avail: number | null = p.stock;
    if (p.kind === "bundle") {
      for (const c of comps) {
        if (c.bundleId !== p.id || c.stock == null) continue;
        const n = Math.floor(c.stock / c.qty);
        avail = avail == null ? n : Math.min(avail, n);
      }
    }
    out.set(p.id, avail == null ? null : Math.max(0, avail));
  }
  return out;
}

export type CardProduct = {
  id: number;
  name: string;
  slug: string;
  kind: "single" | "bundle";
  bundleGroup: string | null;
  tagline: string | null;
  image: string | null;
  price: number;
  mrp: number | null;
  saleLabel: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  itemCount: number;
  worth: number;
  available: number | null;
  trending: boolean;
  pinned: boolean;
  featured: boolean;
  upcoming: boolean;
  launchAt: Date | null;
  score: number;
  createdAt: Date;
};

/** Trending = recent paid sales (last 14 days weigh more) + admin boost. Pinned items always first. */
async function scores(db: DB) {
  const since = new Date(Date.now() - 60 * 864e5);
  const recent = new Date(Date.now() - 14 * 864e5);
  const rows = await db
    .select({
      productId: orderItems.productId,
      score: sql<number>`sum(case when ${orders.paidAt} > ${recent.toISOString()}::timestamptz then ${orderItems.qty} * 10 else ${orderItems.qty} * 3 end)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(isNotNull(orders.paidAt), gt(orders.paidAt, since), notInArray(orders.status, ["cancelled", "refunded"])))
    .groupBy(orderItems.productId);
  return new Map(rows.map((r) => [r.productId!, r.score]));
}

/**
 * Busiest read on the site: memory (20 s) → Redis (up to 15 min, shared by every server) → database.
 * Expires early when a product launches or a sale starts/ends; admin changes and paid orders clear it.
 */
export async function listStoreProducts(db: DB): Promise<CardProduct[]> {
  const r = await sharedCached(
    "store-products",
    {
      memoryMs: 20_000,
      ttl: (r) => secondsUntilNext([r.nextChange, ...r.list.filter((p) => p.upcoming).map((p) => p.launchAt)]),
      revive: (raw) => {
        const r = raw as { list: CardProduct[]; nextChange: string | null };
        return { list: r.list.map((p) => dates(p, ["createdAt", "launchAt"])), nextChange: r.nextChange };
      },
    },
    async () => {
      const [list, info] = await Promise.all([loadStoreProducts(db), discountInfo(db)]);
      return { list, nextChange: info.nextChange };
    },
  );
  return r.list;
}

async function loadStoreProducts(db: DB): Promise<CardProduct[]> {
  const [rows, sc, discs] = await Promise.all([
    db
      .select({ p: products, catName: categories.name, catSlug: categories.slug })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(eq(products.visibility, "public"))
      .orderBy(desc(products.createdAt)),
    scores(db),
    liveDiscounts(db),
  ]);
  const ids = rows.map((r) => r.p.id);
  const comps = ids.length
    ? await db
        .select({ bundleId: bundleItems.bundleId, qty: bundleItems.qty, price: products.price, visibility: products.visibility })
        .from(bundleItems)
        .innerJoin(products, eq(products.id, bundleItems.productId))
        .where(inArray(bundleItems.bundleId, ids))
    : [];
  const avail = await availability(db, rows.map((r) => r.p));
  const sales = discs.filter((d) => d.kind === "sale");

  const cards = rows.map(({ p, catName, catSlug }) => {
    const mine = comps.filter((c) => c.bundleId === p.id && c.visibility === "public");
    const ep = effectivePrice(p, sales);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      kind: p.kind,
      bundleGroup: p.bundleGroup,
      tagline: p.tagline,
      image: p.images[0] ?? null,
      price: ep.price,
      mrp: ep.mrp,
      saleLabel: ep.saleLabel,
      categoryName: catName,
      categorySlug: catSlug,
      itemCount: mine.reduce((s, c) => s + c.qty, 0),
      worth: mine.reduce((s, c) => s + c.price * c.qty, 0),
      available: avail.get(p.id) ?? null,
      trending: false,
      pinned: p.pinRank != null,
      featured: p.featured,
      upcoming: isUpcoming(p),
      launchAt: p.launchAt,
      score: (sc.get(p.id) ?? 0) + p.boost,
      createdAt: p.createdAt,
      pinRank: p.pinRank,
    };
  });
  cards.sort(
    (a, b) =>
      (a.pinRank ?? Infinity) - (b.pinRank ?? Infinity) ||
      b.score - a.score ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const top = cards.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  for (const t of top) t.trending = true;
  return cards.map(({ pinRank: _p, ...c }) => c);
}

/** `/shop?group=items`: every single item (malas, tilak, itra…), as opposed to boxes and sets. */
export const ITEMS_GROUP = "items";
export const groupSlug = (group: string) => group.toLowerCase().replace(/\s+/g, "-");

/** Box/set groups that have something in the store right now, most products first, Bhakti Boxes always first. */
export function liveGroups(all: CardProduct[]) {
  const counts = new Map<string, number>();
  for (const p of all) if (p.kind === "bundle" && p.bundleGroup) counts.set(p.bundleGroup, (counts.get(p.bundleGroup) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => Number(b[0] === "Bhakti Boxes") - Number(a[0] === "Bhakti Boxes") || b[1] - a[1])
    .map(([name, count]) => ({ name, slug: groupSlug(name), count }));
}

export type ShopQuery = {
  category?: string;
  group?: string;
  q?: string;
  sort?: "trending" | "price-asc" | "price-desc" | "new";
  inStock?: boolean;
};

export function filterProducts(all: CardProduct[], f: ShopQuery) {
  let list = all;
  if (f.category) list = list.filter((p) => p.categorySlug === f.category);
  if (f.group === ITEMS_GROUP) list = list.filter((p) => p.kind === "single");
  else if (f.group) list = list.filter((p) => p.bundleGroup && groupSlug(p.bundleGroup) === f.group);
  // Forgiving search (typos, half words, spelling variants); results come best match first.
  if (f.q?.trim()) list = searchProducts(f.q, list);
  if (f.inStock) list = list.filter((p) => p.available !== 0 && !p.upcoming);
  if (f.q?.trim() && (!f.sort || f.sort === "trending")) return list;
  if (f.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  if (f.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  if (f.sort === "new") list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return list;
}

/** Product page data: cached like the catalogue (per product), so a popular page doesn't mean repeated queries. */
export async function productDetail(db: DB, slug: string, countView = true) {
  const p = await sharedCached(
    `product:${slug}`,
    {
      memoryMs: 20_000,
      ttl: (d) => (d ? secondsUntilNext([d.nextChange, d.upcoming ? d.launchAt : null]) : 900),
      revive: (raw) => (raw ? dates(raw as NonNullable<ProductDetailCache>, ["launchAt"]) : null),
    },
    () => loadProductDetail(db, slug),
  );
  if (p && countView) await countProductView(db, p.id);
  if (!p) return null;
  const { nextChange: _n, ...detail } = p;
  return detail;
}

/** Views are counted in Redis and written to the database once every 10 (no write per page view). */
async function countProductView(db: DB, id: number) {
  if (redisEnabled()) {
    const r = await redisPipeline([["INCR", nsKey(`views:${id}`)], ["EXPIRE", nsKey(`views:${id}`), 30 * 86400]]);
    const n = Number(r?.[0]?.result ?? 0);
    if (n > 0 && n % 10 === 0) await db.update(products).set({ viewCount: sql`${products.viewCount} + 10` }).where(eq(products.id, id));
    if (r) return;
  }
  // No Redis: sample instead (one write per ~10 views).
  if (Math.random() < 0.1) await db.update(products).set({ viewCount: sql`${products.viewCount} + 10` }).where(eq(products.id, id));
}

type ProductDetailCache = Awaited<ReturnType<typeof loadProductDetail>>;

async function loadProductDetail(db: DB, slug: string) {
  const [row] = await db
    .select({ p: products, catName: categories.name, catSlug: categories.slug })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.visibility, "public")))
    .limit(1);
  if (!row) return null;
  const p = row.p;
  const components =
    p.kind === "bundle"
      ? await db
          .select({ id: products.id, name: products.name, slug: products.slug, price: products.price, image: sql<string | null>`${products.images}->>0`, visibility: products.visibility, qty: bundleItems.qty, tagline: products.tagline })
          .from(bundleItems)
          .innerJoin(products, eq(products.id, bundleItems.productId))
          .where(eq(bundleItems.bundleId, p.id))
      : [];
  const info = await discountInfo(db);
  const sales = info.live.filter((d) => d.kind === "sale");
  const ep = effectivePrice(p, sales);
  const avail = (await availability(db, [p])).get(p.id) ?? null;
  const visible = components.filter((c) => c.visibility === "public");
  // Bundles this item is part of
  const partOf =
    p.kind === "single"
      ? await db
          .select({ slug: products.slug, name: products.name })
          .from(bundleItems)
          .innerJoin(products, eq(products.id, bundleItems.bundleId))
          .where(and(eq(bundleItems.productId, p.id), eq(products.visibility, "public")))
      : [];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    kind: p.kind,
    bundleGroup: p.bundleGroup,
    tagline: p.tagline,
    description: p.description,
    images: p.images,
    categoryName: row.catName,
    categorySlug: row.catSlug,
    price: ep.price,
    mrp: ep.mrp,
    saleLabel: ep.saleLabel,
    available: avail,
    components: visible.map(({ visibility: _v, ...c }) => c),
    worth: visible.reduce((s, c) => s + c.price * c.qty, 0),
    partOf,
    upcoming: isUpcoming(p),
    launchAt: p.launchAt,
    nextChange: info.nextChange,
  };
}

export function storeCategories(db: DB) {
  return sharedCached("store-categories", { memoryMs: 60_000 }, () => loadCategories(db));
}

function loadCategories(db: DB) {
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, count: sql<number>`count(${products.id})`.mapWith(Number) })
    .from(categories)
    .innerJoin(products, and(eq(products.categoryId, categories.id), eq(products.visibility, "public")))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder, categories.name);
}
