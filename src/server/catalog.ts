import { discountState } from "@/lib/discount-status";
import { cached } from "./cache";
import { redisGetJson, redisSetJson } from "./redis";

export const CATALOG_REDIS_KEY = "cache:store-products:v1";
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

export function liveDiscounts(db: DB) {
  return cached("live-discounts", 15_000, () => loadLiveDiscounts(db));
}

async function loadLiveDiscounts(db: DB) {
  const rows = await db.select().from(discounts).where(eq(discounts.active, true));
  return rows.filter((d) => isDiscountLive(d));
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

/** Busiest read on the site: memory (20s) → Redis (60s, shared by every server) → database. */
export function listStoreProducts(db: DB): Promise<CardProduct[]> {
  return cached("store-products", 20_000, async () => {
    const hit = await redisGetJson<CardProduct[]>(CATALOG_REDIS_KEY);
    if (hit) return hit.map((p) => ({ ...p, createdAt: new Date(p.createdAt), launchAt: p.launchAt ? new Date(p.launchAt) : null }));
    const fresh = await loadStoreProducts(db);
    await redisSetJson(CATALOG_REDIS_KEY, fresh, 60);
    return fresh;
  });
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
  if (f.group) list = list.filter((p) => p.bundleGroup?.toLowerCase().replace(/\s+/g, "-") === f.group);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((p) => `${p.name} ${p.tagline ?? ""} ${p.categoryName ?? ""} ${p.bundleGroup ?? ""}`.toLowerCase().includes(q));
  }
  if (f.inStock) list = list.filter((p) => p.available !== 0 && !p.upcoming);
  if (f.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  if (f.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  if (f.sort === "new") list = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return list;
}

export async function productDetail(db: DB, slug: string, countView = true) {
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
  const sales = (await liveDiscounts(db)).filter((d) => d.kind === "sale");
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
  // Sampled view counting: one write per ~10 views keeps a traffic spike from becoming a write spike.
  if (countView && Math.random() < 0.1) await db.update(products).set({ viewCount: sql`${products.viewCount} + 10` }).where(eq(products.id, p.id));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
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
  };
}

export function storeCategories(db: DB) {
  return cached("store-categories", 60_000, () => loadCategories(db));
}

function loadCategories(db: DB) {
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, count: sql<number>`count(${products.id})`.mapWith(Number) })
    .from(categories)
    .innerJoin(products, and(eq(products.categoryId, categories.id), eq(products.visibility, "public")))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder, categories.name);
}
