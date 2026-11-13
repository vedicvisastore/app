/**
 * Per-product sales numbers for Admin → Analytics → Products.
 * Counts paid orders that weren't cancelled or refunded. Sales are line totals (before coupons and cart offers);
 * profit uses today's cost (a box's cost = its components, packing included).
 */
import { and, desc, eq, gte, isNotNull, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { bundleItems, orderItems, orders, pincodeGeo, products } from "@/db/schema";

const paid = (since: Date | null) => and(isNotNull(orders.paidAt), notInArray(orders.status, ["cancelled", "refunded"]), since ? gte(orders.paidAt, since) : undefined);
const sinceOf = (days: number) => (days ? new Date(Date.now() - days * 864e5) : null);

async function unitCosts(db: DB) {
  const [all, comps] = await Promise.all([
    db.select({ id: products.id, kind: products.kind, cost: products.cost }).from(products),
    db.select({ bundleId: bundleItems.bundleId, qty: bundleItems.qty, cost: products.cost }).from(bundleItems).innerJoin(products, eq(products.id, bundleItems.productId)),
  ]);
  const m = new Map<number, number>();
  for (const p of all) m.set(p.id, p.kind === "bundle" ? comps.filter((c) => c.bundleId === p.id).reduce((s, c) => s + c.cost * c.qty, 0) : p.cost);
  return m;
}

export async function productSalesTable(db: DB, days: number) {
  const since = sinceOf(days);
  const [list, sold, inBoxes, costs] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, kind: products.kind, visibility: products.visibility, image: sql<string | null>`${products.images}->>0`, views: products.viewCount, stock: products.stock })
      .from(products)
      .where(notInArray(products.visibility, ["internal"])),
    db
      .select({
        productId: orderItems.productId,
        units: sql<number>`sum(${orderItems.qty})`.mapWith(Number),
        orders: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number),
        sales: sql<number>`sum(${orderItems.lineTotal})`.mapWith(Number),
        last: sql<Date>`max(${orders.paidAt})`.mapWith((v) => new Date(v)),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(paid(since))
      .groupBy(orderItems.productId),
    // Units of a single item that went out inside boxes
    db
      .select({ productId: bundleItems.productId, units: sql<number>`sum(${orderItems.qty} * ${bundleItems.qty})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(bundleItems, eq(bundleItems.bundleId, orderItems.productId))
      .where(paid(since))
      .groupBy(bundleItems.productId),
    unitCosts(db),
  ]);
  const s = new Map(sold.map((r) => [r.productId, r]));
  const b = new Map(inBoxes.map((r) => [r.productId, r.units]));
  return list
    .map((p) => {
      const r = s.get(p.id);
      const units = r?.units ?? 0;
      const sales = r?.sales ?? 0;
      return {
        ...p,
        units,
        orders: r?.orders ?? 0,
        sales,
        profit: sales - units * (costs.get(p.id) ?? 0),
        unitsInBoxes: b.get(p.id) ?? 0,
        lastSoldAt: r?.last ?? null,
      };
    })
    .sort((a, b2) => b2.sales - a.sales || b2.units - a.units || b2.views - a.views);
}

export async function productSalesDetail(db: DB, id: number, days: number) {
  const since = sinceOf(days);
  const [p] = await db.select({ id: products.id, name: products.name, kind: products.kind, image: sql<string | null>`${products.images}->>0`, views: products.viewCount, stock: products.stock, price: products.price }).from(products).where(eq(products.id, id)).limit(1);
  if (!p) return null;
  const weeksBack = days && days <= 90 ? Math.ceil(days / 7) : 12;
  const weekStart = new Date(Date.now() - weeksBack * 7 * 864e5);
  const [weekly, states, recent, boxes, costs] = await Promise.all([
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${orders.paidAt}), 'YYYY-MM-DD')`, units: sql<number>`sum(${orderItems.qty})`.mapWith(Number), sales: sql<number>`sum(${orderItems.lineTotal})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.productId, id), paid(weekStart)))
      .groupBy(sql`date_trunc('week', ${orders.paidAt})`),
    db
      .select({ state: sql<string>`coalesce(nullif(${pincodeGeo.state}, ''), ${orders.shippingAddress}->>'state', 'Unknown')`, units: sql<number>`sum(${orderItems.qty})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .leftJoin(pincodeGeo, eq(pincodeGeo.pincode, sql`${orders.shippingAddress}->>'pincode'`))
      .where(and(eq(orderItems.productId, id), paid(since)))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({ number: orders.number, id: orders.id, paidAt: orders.paidAt, qty: orderItems.qty, lineTotal: orderItems.lineTotal, city: sql<string>`${orders.shippingAddress}->>'city'` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.productId, id), paid(since)))
      .orderBy(desc(orders.paidAt))
      .limit(8),
    // For a single item: which boxes it goes out in, and how many units that was
    db
      .select({ name: products.name, units: sql<number>`sum(${orderItems.qty} * ${bundleItems.qty})`.mapWith(Number) })
      .from(bundleItems)
      .innerJoin(products, eq(products.id, bundleItems.bundleId))
      .innerJoin(orderItems, eq(orderItems.productId, bundleItems.bundleId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(bundleItems.productId, id), paid(since)))
      .groupBy(products.name),
    unitCosts(db),
  ]);
  const totals = await db
    .select({ units: sql<number>`coalesce(sum(${orderItems.qty}),0)`.mapWith(Number), sales: sql<number>`coalesce(sum(${orderItems.lineTotal}),0)`.mapWith(Number), orders: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.productId, id), paid(since)));
  const t = totals[0] ?? { units: 0, sales: 0, orders: 0 };
  // Fill empty weeks so the chart has no gaps
  const byWeek = new Map(weekly.map((w) => [w.week, w]));
  const series: { week: string; units: number; sales: number }[] = [];
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(monday.getTime() - i * 7 * 864e5).toISOString().slice(0, 10);
    series.push({ week: d, units: byWeek.get(d)?.units ?? 0, sales: byWeek.get(d)?.sales ?? 0 });
  }
  return {
    product: p,
    units: t.units,
    sales: t.sales,
    orders: t.orders,
    profit: t.sales - t.units * (costs.get(id) ?? 0),
    unitCost: costs.get(id) ?? 0,
    series,
    states,
    recent,
    boxes: boxes.sort((a, b) => b.units - a.units),
  };
}
