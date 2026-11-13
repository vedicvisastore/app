import { randomInt } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { orderEvents, orderItems, orders, type AddressSnapshot } from "@/db/schema";
import { STATUS_MESSAGE } from "@/lib/order-machine";
import { transitionOrder } from "./order-transition";
import type { Quote } from "./pricing";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const newOrderNumber = () => "VV-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function createPendingOrder(
  db: DB,
  args: { userId: number; email: string; quote: Quote; address: AddressSnapshot; couponCode: string | null },
) {
  const { quote } = args;
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = newOrderNumber();
    try {
      return await db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({
            number,
            userId: args.userId,
            email: args.email,
            subtotal: quote.subtotal,
            discountTotal: quote.discountTotal,
            shippingFee: quote.shippingFee,
            total: quote.total,
            couponCode: quote.coupon?.applied ? args.couponCode : null,
            discountLines: quote.discountLines,
            shippingAddress: args.address,
          })
          .returning();
        await tx.insert(orderItems).values(
          quote.lines.map((l) => ({
            orderId: order.id,
            productId: l.productId,
            name: l.name,
            sku: l.sku,
            image: l.image,
            unitPrice: l.unitPrice,
            unitMrp: l.unitMrp,
            qty: l.qty,
            lineTotal: l.lineTotal,
          })),
        );
        await tx.insert(orderEvents).values({ orderId: order.id, status: "pending_payment", message: STATUS_MESSAGE.pending_payment, source: "system" });
        return order;
      });
    } catch (e) {
      if (String(e).includes("orders_number_unique") && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("Could not create order");
}

/** Payment confirmed (checkout handler, Razorpay webhook, or a zero-total order). Idempotent. */
export async function markOrderPaid(db: DB, orderId: number, paymentId: string | null, source: "checkout" | "webhook" | "system") {
  const r = await transitionOrder(db, { orderId, to: "paid", actor: source === "system" ? "system" : "payment", source, paymentId });
  if (!r.ok) console.warn(`markOrderPaid(${orderId}) refused: ${r.message}`);
  return r;
}

/** Unpaid orders older than a day move to "cancelled" through the state machine. Cheap; called on new checkouts. */
export async function expireStaleOrders(db: DB, olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600e3);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lt(orders.createdAt, cutoff)))
    .limit(25);
  for (const o of stale) await transitionOrder(db, { orderId: o.id, to: "cancelled", actor: "system", source: "system", message: "Cancelled automatically: payment wasn’t completed within a day" });
  return stale.length;
}
