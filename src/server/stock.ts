/**
 * The only way stock changes: every change writes a ledger row with the balance after it.
 * Products whose stock is untracked (null) are skipped, except a "restock"/"opening" entry,
 * which starts tracking from zero.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { bundleItems, products, stockMovements, type StockReason } from "@/db/schema";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Exec = DB | Tx;

export type Move = {
  productId: number;
  delta: number;
  reason: StockReason;
  orderId?: number | null;
  note?: string | null;
  unitCost?: number | null;
  userId?: number | null;
};

export async function moveStock(db: Exec, m: Move) {
  if (!m.delta) return null;
  const startTracking = m.reason === "restock" || m.reason === "opening";
  const [row] = await db
    .update(products)
    .set({ stock: sql`greatest(coalesce(${products.stock}, 0) + ${m.delta}, 0)`, updatedAt: new Date() })
    .where(and(eq(products.id, m.productId), startTracking ? undefined : sql`${products.stock} is not null`))
    .returning({ stock: products.stock });
  if (!row) return null;
  const [mv] = await db
    .insert(stockMovements)
    .values({
      productId: m.productId,
      delta: m.delta,
      balanceAfter: row.stock ?? 0,
      reason: m.reason,
      orderId: m.orderId ?? null,
      note: m.note ?? null,
      unitCost: m.unitCost ?? null,
      userId: m.userId ?? null,
    })
    .returning();
  return mv;
}

/** Set stock to an exact count (a stock-take); records the difference as an adjustment. */
export async function setStock(db: Exec, productId: number, count: number | null, userId: number | null, note = "Stock count corrected") {
  const [p] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return;
  if (count === null) {
    await db.update(products).set({ stock: null }).where(eq(products.id, productId));
    return;
  }
  if (p.stock === null) return moveStock(db, { productId, delta: count, reason: "opening", note: "Started tracking stock", userId });
  return moveStock(db, { productId, delta: count - p.stock, reason: "adjustment", note, userId });
}

/** Take (sign -1) or give back (sign +1) the stock for an order line, expanding boxes into their items.
 * Returns the items that didn't have enough stock (only possible when two people buy the last units at once). */
export async function moveForOrderLine(tx: Exec, productId: number, qty: number, sign: 1 | -1, orderId: number, orderNumber: string) {
  const reason: StockReason = sign < 0 ? "order" : "cancel";
  const note = sign < 0 ? `Order ${orderNumber}` : `Order ${orderNumber} cancelled, items back on the shelf`;
  const short: string[] = [];
  const take = async (id: number, n: number) => {
    if (sign < 0) {
      const [p] = await tx.select({ name: products.name, stock: products.stock }).from(products).where(eq(products.id, id)).limit(1);
      if (p && p.stock !== null && p.stock < n) short.push(`${p.name} (needed ${n}, had ${p.stock})`);
    }
    await moveStock(tx, { productId: id, delta: sign * n, reason, orderId, note });
  };
  await take(productId, qty);
  const comps = await tx.select().from(bundleItems).where(eq(bundleItems.bundleId, productId));
  for (const c of comps) await take(c.productId, c.qty * qty);
  return short;
}

export async function ledger(db: DB, productId: number, limit = 200) {
  return db.select().from(stockMovements).where(eq(stockMovements.productId, productId)).orderBy(desc(stockMovements.createdAt), desc(stockMovements.id)).limit(limit);
}
