import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, notInArray, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import {
  bundleItems,
  categories,
  discounts,
  FESTIVAL_ACCENTS,
  festivalProducts,
  festivals,
  orderEvents,
  orderItems,
  orders,
  pincodeGeo,
  products,
  stockMovements,
  users,
  webhookEvents,
  type OrderStatus,
} from "@/db/schema";
import { importSheet } from "@/lib/excel-apply";
import { festivalState } from "@/lib/festival-status";
import { safeRibbonHref } from "@/lib/settings-defaults";
import { slugify } from "@/lib/utils";
import { availability } from "../catalog";
import { env } from "../env";
import { nextStates } from "@/lib/order-machine";
import { CONTENT_KEYS } from "@/content/defaults";
import { THEMES } from "@/lib/themes";
import { getSiteConfig, saveSiteConfig, siteConfigStorage } from "../site-config";
import { transitionOrder } from "../order-transition";
import { getSettings, saveSettings } from "../settings";
import { productSalesDetail, productSalesTable } from "../product-analytics";
import { clearPreviewCookie, encodePreview, previewCookie } from "../content-preview";
import { moveStock, setStock } from "../stock";
import { ALLOWED_MEDIA, deleteMedia, mediaBucket, presignUpload } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../trpc";

/** Custom pages that can sit in the store menu at once (keeps the menu short). */
const MAX_MENU_PAGES = 2;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const STATUSES = ["pending_payment", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"] as const;

async function uniqueSlug(db: Parameters<typeof importSheet>[0], base: string, selfId?: number) {
  let s = base || "product";
  for (let i = 2; ; i++) {
    const [f] = await db.select({ id: products.id }).from(products).where(eq(products.slug, s)).limit(1);
    if (!f || f.id === selfId) return s;
    s = `${base}-${i}`;
  }
}

const productInput = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40),
  slug: z.string().trim().max(120).optional(),
  kind: z.enum(["single", "bundle"]),
  bundleGroup: z.string().trim().max(60).nullable().optional(),
  categoryId: z.number().nullable().optional(),
  tagline: z.string().trim().max(140).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.number().int().min(0),
  mrp: z.number().int().min(0).nullable().optional(),
  cost: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).nullable().optional(),
  visibility: z.enum(["public", "hidden", "internal"]),
  images: z.array(z.string().max(500)).max(24).default([]),
  pinRank: z.number().int().min(1).max(999).nullable().optional(),
  boost: z.number().int().min(-1000).max(1000).default(0),
  featured: z.boolean().default(false),
  comingSoon: z.boolean().default(false),
  launchAt: z.date().nullable().optional(),
  components: z.array(z.object({ productId: z.number(), qty: z.number().int().min(1).max(50) })).default([]),
});

export const adminRouter = router({
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const db = ctx.db;
    const day = (n: number) => new Date(Date.now() - n * 864e5);
    const paid = and(isNotNull(orders.paidAt), notInArray(orders.status, ["cancelled", "refunded"]));
    const revenue = async (since: Date) => {
      const [r] = await db.select({ total: sum(orders.total).mapWith(Number), n: count() }).from(orders).where(and(paid, gte(orders.paidAt, since)));
      return { total: r.total ?? 0, orders: r.n };
    };
    const [today, week, month, byStatus, recent, top, singles] = await Promise.all([
      revenue(new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30")),
      revenue(day(7)),
      revenue(day(30)),
      db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
      db.select().from(orders).where(sql`${orders.status} <> 'pending_payment'`).orderBy(desc(orders.createdAt)).limit(8),
      db
        .select({ name: orderItems.name, qty: sum(orderItems.qty).mapWith(Number), revenue: sum(orderItems.lineTotal).mapWith(Number) })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(paid, gte(orders.paidAt, day(30))))
        .groupBy(orderItems.name)
        .orderBy(desc(sum(orderItems.qty)))
        .limit(6),
      db.select({ id: products.id, name: products.name, stock: products.stock, visibility: products.visibility }).from(products).where(and(eq(products.kind, "single"), isNotNull(products.stock), sql`${products.stock} <= 5`)).orderBy(products.stock).limit(12),
    ]);
    return { today, week, month, byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.n])) as Record<string, number>, recent, top, lowStock: singles };
  }),

  // ── Products & bundles ─────────────────────────────────
  products: adminProcedure
    .input(z.object({ q: z.string().optional(), kind: z.enum(["single", "bundle"]).optional(), visibility: z.enum(["public", "hidden", "internal"]).optional(), categoryId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const where = and(
        input.q ? or(ilike(products.name, `%${input.q}%`), ilike(products.sku, `%${input.q}%`)) : undefined,
        input.kind ? eq(products.kind, input.kind) : undefined,
        input.visibility ? eq(products.visibility, input.visibility) : undefined,
        input.categoryId ? eq(products.categoryId, input.categoryId) : undefined,
      );
      const rows = await ctx.db
        .select({ p: products, catName: categories.name })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(where)
        .orderBy(sql`${products.pinRank} asc nulls last`, products.kind, products.name);
      const ids = rows.map((r) => r.p.id);
      const comps = ids.length
        ? await ctx.db
            .select({ bundleId: bundleItems.bundleId, productId: bundleItems.productId, qty: bundleItems.qty, name: products.name, cost: products.cost, price: products.price, visibility: products.visibility })
            .from(bundleItems)
            .innerJoin(products, eq(products.id, bundleItems.productId))
            .where(or(inArray(bundleItems.bundleId, ids), inArray(bundleItems.productId, ids)))
        : [];
      const bundleNames = new Map(rows.filter((r) => r.p.kind === "bundle").map((r) => [r.p.id, r.p.name]));
      const avail = await availability(ctx.db, rows.map((r) => r.p));
      return rows.map(({ p, catName }) => {
        const mine = comps.filter((c) => c.bundleId === p.id);
        return {
          ...p,
          categoryName: catName,
          available: avail.get(p.id) ?? null,
          components: mine,
          componentCost: mine.reduce((s, c) => s + c.cost * c.qty, 0),
          componentValue: mine.filter((c) => c.visibility === "public").reduce((s, c) => s + c.price * c.qty, 0),
          inBundles: comps.filter((c) => c.productId === p.id).map((c) => bundleNames.get(c.bundleId)).filter(Boolean) as string[],
        };
      });
    }),
  product: adminProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [p] = await ctx.db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!p) throw new TRPCError({ code: "NOT_FOUND" });
    const components = await ctx.db.select({ productId: bundleItems.productId, qty: bundleItems.qty }).from(bundleItems).where(eq(bundleItems.bundleId, p.id));
    return { ...p, components };
  }),
  saveProduct: adminProcedure.input(productInput).mutation(async ({ ctx, input }) => {
    const { id, components, ...data } = input;
    const sku = data.sku.toUpperCase().replace(/\s+/g, "-");
    const [skuClash] = await ctx.db.select({ id: products.id }).from(products).where(eq(products.sku, sku)).limit(1);
    if (skuClash && skuClash.id !== id) throw new TRPCError({ code: "CONFLICT", message: `SKU ${sku} is already used by another product.` });
    if (data.kind === "bundle" && components.some((c) => c.productId === id)) throw new TRPCError({ code: "BAD_REQUEST", message: "A bundle can't contain itself." });

    const values = {
      ...data,
      sku,
      slug: await uniqueSlug(ctx.db, slugify(data.slug || data.name), id),
      mrp: data.mrp && data.mrp > data.price ? data.mrp : null,
      bundleGroup: data.kind === "bundle" ? data.bundleGroup || null : null,
      updatedAt: new Date(),
    };
    const { stock, ...rest } = values;
    return ctx.db.transaction(async (tx) => {
      let pid = id;
      if (id) await tx.update(products).set(rest).where(eq(products.id, id));
      else pid = (await tx.insert(products).values({ ...rest, stock: null }).returning())[0].id;
      await setStock(tx, pid!, stock ?? null, ctx.user.id, "Stock count corrected in the product editor");
      await tx.delete(bundleItems).where(eq(bundleItems.bundleId, pid!));
      if (data.kind === "bundle" && components.length) {
        const merged = new Map<number, number>();
        for (const c of components) merged.set(c.productId, (merged.get(c.productId) ?? 0) + c.qty);
        await tx.insert(bundleItems).values([...merged].map(([productId, qty]) => ({ bundleId: pid!, productId, qty })));
      }
      return { id: pid! };
    });
  }),
  quickUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        pinRank: z.number().int().min(1).max(999).nullable().optional(),
        boost: z.number().int().min(-1000).max(1000).optional(),
        stock: z.number().int().min(0).nullable().optional(),
        price: z.number().int().min(0).optional(),
        visibility: z.enum(["public", "hidden", "internal"]).optional(),
        featured: z.boolean().optional(),
        comingSoon: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, stock, ...patch } = input;
      if (Object.keys(patch).length) await ctx.db.update(products).set({ ...patch, updatedAt: new Date() }).where(eq(products.id, id));
      if (stock !== undefined) await setStock(ctx.db, id, stock, ctx.user.id, "Stock count corrected from the products table");
      return { ok: true };
    }),
  deleteProduct: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const usedIn = await ctx.db
      .select({ name: products.name })
      .from(bundleItems)
      .innerJoin(products, eq(products.id, bundleItems.bundleId))
      .where(eq(bundleItems.productId, input.id));
    if (usedIn.length)
      throw new TRPCError({ code: "CONFLICT", message: `It's inside ${usedIn.map((u) => u.name).join(", ")}. Remove it from those bundles first, or hide it instead.` });
    const [p] = await ctx.db.delete(products).where(eq(products.id, input.id)).returning();
    if (p) await Promise.allSettled(p.images.map(deleteMedia));
    return { ok: true };
  }),

  // ── Analytics: where orders come from ──────────────────
  productAnalytics: adminProcedure.input(z.object({ days: z.number().int().min(0).max(3650) })).query(({ ctx, input }) => productSalesTable(ctx.db, input.days)),
  productAnalyticsDetail: adminProcedure.input(z.object({ id: z.number().int(), days: z.number().int().min(0).max(3650) })).query(async ({ ctx, input }) => {
    const d = await productSalesDetail(ctx.db, input.id, input.days);
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return d;
  }),
  geoAnalytics: adminProcedure.input(z.object({ days: z.number().int().min(0).max(3650) })).query(async ({ ctx, input }) => {
    const since = input.days ? new Date(Date.now() - input.days * 864e5) : null;
    const rows = await ctx.db
      .select({
        pincode: sql<string>`${orders.shippingAddress}->>'pincode'`,
        orders: count(),
        revenue: sum(orders.total).mapWith(Number),
        lat: pincodeGeo.lat,
        lng: pincodeGeo.lng,
        district: pincodeGeo.district,
        state: pincodeGeo.state,
        city: sql<string>`max(${orders.shippingAddress}->>'city')`,
        addrState: sql<string>`max(${orders.shippingAddress}->>'state')`,
      })
      .from(orders)
      .leftJoin(pincodeGeo, eq(pincodeGeo.pincode, sql`${orders.shippingAddress}->>'pincode'`))
      .where(and(isNotNull(orders.paidAt), notInArray(orders.status, ["cancelled", "refunded"]), since ? gte(orders.paidAt, since) : undefined))
      .groupBy(sql`${orders.shippingAddress}->>'pincode'`, pincodeGeo.lat, pincodeGeo.lng, pincodeGeo.district, pincodeGeo.state);
    const points = rows.map((r) => ({
      pincode: r.pincode,
      orders: r.orders,
      revenue: r.revenue ?? 0,
      lat: r.lat,
      lng: r.lng,
      district: r.district || r.city || "Unknown",
      state: r.state || r.addrState || "Unknown",
    }));
    const total = points.reduce((s, p) => s + p.orders, 0);
    const group = (key: "state" | "district") => {
      const m = new Map<string, { name: string; state: string; orders: number; revenue: number }>();
      for (const p of points) {
        const k = key === "state" ? p.state : `${p.district}|${p.state}`;
        const e = m.get(k) ?? { name: key === "state" ? p.state : p.district, state: p.state, orders: 0, revenue: 0 };
        e.orders += p.orders;
        e.revenue += p.revenue;
        m.set(k, e);
      }
      return [...m.values()].sort((a, b) => b.orders - a.orders);
    };
    return { total, revenue: points.reduce((s, p) => s + p.revenue, 0), points, states: group("state"), districts: group("district").slice(0, 25), unmapped: points.filter((p) => p.lat == null).reduce((s, p) => s + p.orders, 0) };
  }),
  /** Every pincode's location, packed as [lat*100, lng*100, ...]. Draws the map's shape at any zoom. */
  pincodeGrid: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select({ lat: pincodeGeo.lat, lng: pincodeGeo.lng }).from(pincodeGeo).where(isNotNull(pincodeGeo.lat));
    const out: number[] = [];
    for (const r of rows) out.push(Math.round(r.lat! * 100), Math.round(r.lng! * 100));
    return out;
  }),

  // ── Look and copy (saved as one JSON file in R2, not the database) ──
  siteConfig: adminProcedure.query(async () => {
    const cfg = await getSiteConfig();
    return { theme: cfg.theme, customTheme: cfg.customTheme, content: cfg.content, updatedAt: cfg.updatedAt ?? null, storage: siteConfigStorage() };
  }),
  saveTheme: adminProcedure
    .input(
      z.object({
        theme: z.string().regex(/^[a-z0-9-]{2,30}$/),
        customTheme: z.object({ field: hex, primary: hex, button: hex, accent: hex, paper: hex }).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.theme !== "custom" && !THEMES.some((t) => t.key === input.theme)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown theme." });
      const cfg = await getSiteConfig();
      await saveSiteConfig({ ...cfg, theme: input.theme, customTheme: input.customTheme ?? cfg.customTheme });
      return { ok: true };
    }),
  /** Live preview: unsaved text goes into a short-lived cookie that only admins' page views honour. */
  // protectedProcedure + inline admin check: adminProcedure would clear the catalogue cache on every keystroke.
  previewContent: protectedProcedure.input(z.object({ content: z.record(z.string(), z.string().max(600)) })).mutation(({ ctx, input }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admins only." });
    const value = encodePreview(input.content);
    if (!value) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Too much unsaved text to preview. Save first, then keep editing." });
    ctx.setCookie(previewCookie(value));
    return { ok: true };
  }),
  endPreview: protectedProcedure.mutation(({ ctx }) => {
    ctx.setCookie(clearPreviewCookie());
    return { ok: true };
  }),
  saveContent: adminProcedure
    .input(z.object({ content: z.record(z.string(), z.string().max(600)) }))
    .mutation(async ({ input }) => {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.content)) {
        if (!CONTENT_KEYS.has(k)) continue;
        const text = v.trim();
        if (text) clean[k] = text;
      }
      const cfg = await getSiteConfig();
      await saveSiteConfig({ ...cfg, content: clean });
      return { ok: true, saved: Object.keys(clean).length };
    }),

  // ── Stock ledger ───────────────────────────────────────
  stockLedger: adminProcedure.input(z.object({ productId: z.number() })).query(async ({ ctx, input }) => {
    const [p] = await ctx.db.select({ id: products.id, name: products.name, sku: products.sku, stock: products.stock, cost: products.cost, kind: products.kind }).from(products).where(eq(products.id, input.productId)).limit(1);
    if (!p) throw new TRPCError({ code: "NOT_FOUND" });
    const rows = await ctx.db
      .select({ m: stockMovements, orderNumber: orders.number, by: users.email })
      .from(stockMovements)
      .leftJoin(orders, eq(orders.id, stockMovements.orderId))
      .leftJoin(users, eq(users.id, stockMovements.userId))
      .where(eq(stockMovements.productId, p.id))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(300);
    const totals = { in: 0, out: 0 };
    for (const r of rows) r.m.delta > 0 ? (totals.in += r.m.delta) : (totals.out -= r.m.delta);
    return { product: p, totals, movements: rows.map((r) => ({ ...r.m, orderNumber: r.orderNumber, by: r.by })) };
  }),
  moveStock: adminProcedure
    .input(
      z.object({
        productId: z.number(),
        qty: z.number().int().min(1).max(100000),
        direction: z.enum(["in", "out"]),
        reason: z.enum(["restock", "return", "damaged", "adjustment"]),
        note: z.string().trim().max(200).optional(),
        unitCost: z.number().int().min(0).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const delta = input.direction === "in" ? input.qty : -input.qty;
      const mv = await ctx.db.transaction((tx) =>
        moveStock(tx, { productId: input.productId, delta, reason: input.reason, note: input.note || null, unitCost: input.unitCost ?? null, userId: ctx.user.id }),
      );
      if (!mv) throw new TRPCError({ code: "BAD_REQUEST", message: "This product doesn't track stock. Add stock as a restock to start tracking it." });
      return mv;
    }),

  // ── Media (Cloudflare R2) ──────────────────────────────
  presignUpload: adminProcedure
    .input(z.object({ filename: z.string().max(200), contentType: z.string(), size: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const maxMb = ALLOWED_MEDIA[input.contentType];
      if (!maxMb) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload JPG, PNG, WebP, AVIF, GIF, MP4, WebM or MOV files." });
      if (input.size > maxMb * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: `That file is over ${maxMb} MB.` });
      if (!env.r2Configured()) {
        // On Workers the bucket is bound directly: the browser sends the file to /api/upload, which streams it into R2.
        if (mediaBucket() && env.r2().publicUrl) return { mode: "local" as const };
        if (env.isProd) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Media storage isn't set up (R2_PUBLIC_URL or the bucket binding is missing)." });
        return { mode: "local" as const };
      }
      return { mode: "r2" as const, ...(await presignUpload(input.filename, input.contentType)) };
    }),

  // ── Categories ─────────────────────────────────────────
  categories: adminProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, sortOrder: categories.sortOrder, count: count(products.id) })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder, categories.name),
  ),
  saveCategory: adminProcedure
    .input(z.object({ id: z.number().optional(), name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).nullable().optional(), sortOrder: z.number().int().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const slug = slugify(data.name);
      const [clash] = await ctx.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
      if (clash && clash.id !== id) throw new TRPCError({ code: "CONFLICT", message: "A category with this name already exists." });
      if (id) await ctx.db.update(categories).set({ ...data, slug }).where(eq(categories.id, id));
      else await ctx.db.insert(categories).values({ ...data, slug });
      return { ok: true };
    }),
  deleteCategory: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(categories).where(eq(categories.id, input.id));
    return { ok: true };
  }),

  // ── Orders ─────────────────────────────────────────────
  orders: adminProcedure
    .input(z.object({ status: z.enum(STATUSES).optional(), q: z.string().optional(), includePending: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const where = and(
        input.status ? eq(orders.status, input.status) : input.includePending ? undefined : sql`${orders.status} <> 'pending_payment'`,
        input.q
          ? or(ilike(orders.number, `%${input.q}%`), ilike(orders.email, `%${input.q}%`), sql`${orders.shippingAddress}->>'phone' ilike ${"%" + input.q + "%"}`, sql`${orders.shippingAddress}->>'name' ilike ${"%" + input.q + "%"}`, ilike(orders.trackingNumber, `%${input.q}%`))
          : undefined,
      );
      const list = await ctx.db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(200);
      const items = list.length
        ? await ctx.db.select({ orderId: orderItems.orderId, qty: orderItems.qty, name: orderItems.name }).from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id)))
        : [];
      return list.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
    }),
  order: adminProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [o] = await ctx.db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
    if (!o) throw new TRPCError({ code: "NOT_FOUND" });
    const [items, events, customer] = await Promise.all([
      ctx.db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
      ctx.db.select().from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(desc(orderEvents.createdAt)),
      o.userId ? ctx.db.select().from(users).where(eq(users.id, o.userId)).limit(1) : Promise.resolve([]),
    ]);
    // What to pack: expand bundles into components (incl. packing material)
    const pick = new Map<string, number>();
    for (const it of items) {
      const comps = it.productId
        ? await ctx.db.select({ name: products.name, qty: bundleItems.qty }).from(bundleItems).innerJoin(products, eq(products.id, bundleItems.productId)).where(eq(bundleItems.bundleId, it.productId))
        : [];
      if (!comps.length) pick.set(it.name, (pick.get(it.name) ?? 0) + it.qty);
      for (const c of comps) pick.set(c.name, (pick.get(c.name) ?? 0) + c.qty * it.qty);
    }
    return { ...o, items, events, customer: customer[0] ?? null, pickList: [...pick].map(([name, qty]) => ({ name, qty })), allowedNext: nextStates(o.status, "admin") };
  }),
  updateOrder: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(STATUSES).optional(),
        trackingNumber: z.string().trim().max(40).nullable().optional(),
        message: z.string().trim().max(300).optional(),
        location: z.string().trim().max(100).optional(),
        adminNote: z.string().trim().max(1000).nullable().optional(),
        restock: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [o] = await ctx.db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (!o) throw new TRPCError({ code: "NOT_FOUND" });

      // Plain field edits (not part of the lifecycle)
      const patch: Partial<typeof orders.$inferInsert> = {};
      const tracking = input.trackingNumber === undefined ? undefined : input.trackingNumber?.toUpperCase() || null;
      if (tracking !== undefined && tracking !== o.trackingNumber) patch.trackingNumber = tracking;
      if (input.adminNote !== undefined) patch.adminNote = input.adminNote;
      if (Object.keys(patch).length) await ctx.db.update(orders).set(patch).where(eq(orders.id, o.id));

      // Lifecycle moves go through the state machine
      if (input.status && input.status !== o.status) {
        const r = await transitionOrder(ctx.db, {
          orderId: o.id,
          to: input.status,
          actor: "admin",
          source: "admin",
          trackingNumber: tracking ?? undefined,
          message: input.message,
          location: input.location,
          restock: input.restock,
        });
        if (!r.ok) throw new TRPCError({ code: r.reason === "not_found" ? "NOT_FOUND" : r.reason === "conflict" ? "CONFLICT" : "BAD_REQUEST", message: r.message });
        return { ok: true };
      }

      // A note on the timeline without a status change
      if (input.message || (patch.trackingNumber && o.trackingNumber !== patch.trackingNumber)) {
        await ctx.db.insert(orderEvents).values({
          orderId: o.id,
          status: null,
          message: input.message || `India Post tracking: ${patch.trackingNumber}`,
          location: input.location || null,
          source: "admin",
        });
      }
      return { ok: true };
    }),

  // ── Discounts ──────────────────────────────────────────
  discounts: adminProcedure.query(({ ctx }) => ctx.db.select().from(discounts).orderBy(desc(discounts.active), desc(discounts.createdAt))),
  saveDiscount: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        kind: z.enum(["sale", "coupon", "auto_cart"]),
        name: z.string().trim().min(2).max(80),
        code: z.string().trim().max(30).nullable().optional(),
        type: z.enum(["percent", "flat", "free_shipping"]),
        value: z.number().int().min(0),
        productIds: z.array(z.number()).default([]),
        categoryIds: z.array(z.number()).default([]),
        minSubtotal: z.number().int().min(0).default(0),
        maxDiscount: z.number().int().min(0).nullable().optional(),
        usageLimit: z.number().int().min(1).nullable().optional(),
        perUserLimit: z.number().int().min(1).nullable().optional(),
        startsAt: z.date().nullable().optional(),
        endsAt: z.date().nullable().optional(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...d } = input;
      if (d.type === "percent" && (d.value < 1 || d.value > 90)) throw new TRPCError({ code: "BAD_REQUEST", message: "Percent off must be between 1 and 90." });
      if (d.kind === "sale" && d.type === "free_shipping") throw new TRPCError({ code: "BAD_REQUEST", message: "A sale changes product prices. Use a coupon or automatic cart offer for free shipping." });
      const code = d.kind === "coupon" ? d.code?.toUpperCase().replace(/\s+/g, "") || null : null;
      if (d.kind === "coupon" && !code) throw new TRPCError({ code: "BAD_REQUEST", message: "Coupons need a code." });
      if (code) {
        const [clash] = await ctx.db.select({ id: discounts.id }).from(discounts).where(sql`upper(${discounts.code}) = ${code}`).limit(1);
        if (clash && clash.id !== id) throw new TRPCError({ code: "CONFLICT", message: `Code ${code} already exists.` });
      }
      const values = { ...d, code };
      if (id) await ctx.db.update(discounts).set(values).where(eq(discounts.id, id));
      else await ctx.db.insert(discounts).values(values);
      return { ok: true };
    }),
  toggleDiscount: adminProcedure.input(z.object({ id: z.number(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
    await ctx.db.update(discounts).set({ active: input.active }).where(eq(discounts.id, input.id));
    return { ok: true };
  }),
  deleteDiscount: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(discounts).where(eq(discounts.id, input.id));
    return { ok: true };
  }),

  // ── Festivals ──────────────────────────────────────────
  festivals: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ f: festivals, count: count(festivalProducts.productId) })
      .from(festivals)
      .leftJoin(festivalProducts, eq(festivalProducts.festivalId, festivals.id))
      .groupBy(festivals.id)
      .orderBy(festivals.sortOrder, festivals.festivalDate);
    return rows.map(({ f, count }) => ({ ...f, productCount: count, state: festivalState(f) }));
  }),
  festival: adminProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [f] = await ctx.db.select().from(festivals).where(eq(festivals.id, input.id)).limit(1);
    if (!f) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
    const links = await ctx.db.select().from(festivalProducts).where(eq(festivalProducts.festivalId, f.id)).orderBy(festivalProducts.sortOrder);
    return { ...f, productIds: links.map((l) => l.productId) };
  }),
  /** Light product list for pickers (festivals, etc.). */
  productPicker: adminProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: products.id, name: products.name, kind: products.kind, visibility: products.visibility, image: sql<string | null>`${products.images}->>0`, price: products.price })
      .from(products)
      .where(notInArray(products.visibility, ["internal"]))
      .orderBy(products.name),
  ),
  saveFestival: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().trim().min(2, "Give the page a name").max(60),
        slug: z.string().trim().max(60).optional(),
        tagline: z.string().trim().max(140).nullable(),
        description: z.string().trim().max(1200).nullable(),
        festivalDate: z.date().nullable(),
        showFrom: z.date().nullable(),
        showUntil: z.date().nullable(),
        image: z.string().trim().max(500).nullable(),
        accent: z.enum(FESTIVAL_ACCENTS),
        showInMenu: z.boolean(),
        active: z.boolean(),
        sortOrder: z.number().int().min(0).max(999),
        productIds: z.array(z.number().int()).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, productIds, slug: rawSlug, ...data } = input;
      if (data.showFrom && data.showUntil && data.showUntil <= data.showFrom)
        throw new TRPCError({ code: "BAD_REQUEST", message: "“Hide after” must be later than “Show from”." });
      if (data.image && !/^(https:\/\/|\/)/.test(data.image)) throw new TRPCError({ code: "BAD_REQUEST", message: "Banner must be an uploaded image." });
      const slug = slugify(rawSlug || data.name);
      if (!slug) throw new TRPCError({ code: "BAD_REQUEST", message: "Give the page a name with letters." });
      const [clash] = await ctx.db.select({ id: festivals.id }).from(festivals).where(eq(festivals.slug, slug)).limit(1);
      if (clash && clash.id !== id) throw new TRPCError({ code: "CONFLICT", message: `Another page already uses the link /c/${slug}.` });
      if (data.showInMenu) {
        const others = await ctx.db.select({ id: festivals.id, name: festivals.name }).from(festivals).where(and(eq(festivals.showInMenu, true), eq(festivals.active, true)));
        const inMenu = others.filter((o) => o.id !== id);
        if (inMenu.length >= MAX_MENU_PAGES)
          throw new TRPCError({ code: "BAD_REQUEST", message: `Only ${MAX_MENU_PAGES} pages fit in the store menu. Turn off “Show in the store menu” on ${inMenu.map((o) => o.name).join(" or ")} first.` });
      }
      const unique = [...new Set(productIds)];
      return ctx.db.transaction(async (tx) => {
        let fid = id;
        if (fid) {
          const r = await tx.update(festivals).set({ ...data, slug }).where(eq(festivals.id, fid)).returning({ id: festivals.id });
          if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        } else {
          const [r] = await tx.insert(festivals).values({ ...data, slug }).returning({ id: festivals.id });
          fid = r.id;
        }
        await tx.delete(festivalProducts).where(eq(festivalProducts.festivalId, fid));
        if (unique.length) await tx.insert(festivalProducts).values(unique.map((productId, i) => ({ festivalId: fid!, productId, sortOrder: i })));
        return { id: fid, slug };
      });
    }),
  deleteFestival: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(festivals).where(eq(festivals.id, input.id));
    return { ok: true };
  }),

  // ── Top ribbon ────────────────────────────────────────
  saveRibbon: adminProcedure
    .input(
      z.object({
        items: z.array(z.object({ text: z.string().trim().min(1).max(120), href: z.string().trim().max(300).optional() })).max(12),
        seconds: z.number().int().min(10).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ribbon = input.items.map((i) => {
        const href = safeRibbonHref(i.href);
        if (i.href?.trim() && !href) throw new TRPCError({ code: "BAD_REQUEST", message: `Link “${i.href}” must start with / (a store page) or https://` });
        return href ? { text: i.text, href } : { text: i.text };
      });
      await saveSettings(ctx.db, { ribbon, ribbonSeconds: input.seconds, announcement: ribbon.map((r) => r.text).join(" · ") });
      return { ok: true };
    }),

  // ── Settings & import ──────────────────────────────────
  settings: adminProcedure.query(async ({ ctx }) => ({
    ...(await getSettings(ctx.db)),
    integrations: {
      razorpay: env.razorpayConfigured(),
      razorpayWebhook: !!env.razorpay().webhookSecret,
      r2: env.r2Configured(),
      email: !!env.resendKey(),
      shippingWebhook: !!env.shippingWebhookSecret(),
    },
  })),
  saveSettings: adminProcedure
    .input(
      z.object({
        shippingFee: z.number().int().min(0),
        freeShippingThreshold: z.number().int().min(0),
        announcement: z.string().max(200).optional(),
        deliveryDaysMin: z.number().int().min(1).max(30),
        deliveryDaysMax: z.number().int().min(1).max(45),
        supportEmail: z.string().max(120),
        supportPhone: z.string().max(20),
        instagram: z.string().max(200),
        creatorInstagram: z.string().max(200).optional(),
        youtube: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await saveSettings(ctx.db, input);
      return { ok: true };
    }),
  importSheet: adminProcedure
    .input(
      z.object({
        products: z.array(z.object({ sku: z.string(), name: z.string(), category: z.string(), cost: z.number(), price: z.number() })).max(2000),
        bundles: z.array(z.object({ name: z.string(), group: z.string(), items: z.array(z.string()), mrp: z.number().nullable(), price: z.number().nullable() })).max(200),
        warnings: z.array(z.string()).default([]),
      }),
    )
    .mutation(({ ctx, input }) => importSheet(ctx.db, input)),
  webhookLog: adminProcedure.query(({ ctx }) => ctx.db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(50)),
});
