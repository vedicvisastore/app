/**
 * The only code that changes an order's status. Every move is checked against ORDER_MACHINE,
 * applied with a compare-and-set on the current status (so two simultaneous moves can't both win),
 * and carries its side effects: timestamps, the timeline event, stock, coupon usage and emails.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/connect";
import { discounts, discountUsages, orderEvents, orderItems, orders, stockMovements, type Order, type OrderStatus } from "@/db/schema";
import { PAID_STATES, ruleFor, STATUS_MESSAGE, type Actor } from "@/lib/order-machine";
import { clearCache } from "./cache";
import { sendOrderConfirmation, sendShippedEmail } from "./email";
import { moveForOrderLine } from "./stock";

export type TransitionInput = {
  orderId: number;
  to: OrderStatus;
  actor: Actor;
  /** Who/what to show on the timeline, e.g. "checkout", "webhook:razorpay", "admin" */
  source?: string;
  paymentId?: string | null;
  trackingNumber?: string | null;
  message?: string;
  location?: string | null;
  /** On cancel/refund of a paid order: put the items back in stock */
  restock?: boolean;
};

export type TransitionResult =
  | { ok: true; changed: true; from: OrderStatus; order: Order }
  | { ok: true; changed: false; from: OrderStatus; order: Order } // already in the target state
  | { ok: false; reason: "not_found" | "not_allowed" | "needs_tracking" | "conflict"; from?: OrderStatus; message: string };

export class OrderTransitionError extends Error {}

export async function transitionOrder(db: DB, input: TransitionInput): Promise<TransitionResult> {
  const result = await db.transaction(async (tx): Promise<TransitionResult> => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!o) return { ok: false, reason: "not_found", message: "Order not found." };
    if (o.status === input.to) return { ok: true, changed: false, from: o.status, order: o };

    const rule = ruleFor(o.status, input.to, input.actor);
    if (!rule) {
      return { ok: false, reason: "not_allowed", from: o.status, message: `An order that is ${o.status.replace("_", " ")} can't be moved to ${input.to.replace("_", " ")}.` };
    }
    const tracking = input.trackingNumber?.trim().toUpperCase() || o.trackingNumber;
    if (rule.needsTracking && !tracking) return { ok: false, reason: "needs_tracking", from: o.status, message: "Add the India Post tracking number before marking it shipped." };

    const now = new Date();
    const patch: Partial<typeof orders.$inferInsert> = { status: input.to };
    if (input.to === "paid") Object.assign(patch, { paidAt: now, razorpayPaymentId: input.paymentId ?? o.razorpayPaymentId });
    if (input.to === "shipped") Object.assign(patch, { shippedAt: now, trackingNumber: tracking });
    if (input.to === "delivered") patch.deliveredAt = now;

    // Compare-and-set: only applies if nobody moved the order since we read it.
    const [updated] = await tx
      .update(orders)
      .set(patch)
      .where(and(eq(orders.id, o.id), eq(orders.status, o.status)))
      .returning();
    if (!updated) return { ok: false, reason: "conflict", from: o.status, message: "This order was just updated by someone else. Refresh and try again." };

    // Side effects that belong inside the same transaction
    if (input.to === "paid") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const short: string[] = [];
      for (const it of items) if (it.productId) short.push(...(await moveForOrderLine(tx, it.productId, it.qty, -1, o.id, o.number)));
      for (const l of o.discountLines) {
        await tx.update(discounts).set({ usedCount: sql`${discounts.usedCount} + 1` }).where(eq(discounts.id, l.id));
        await tx.insert(discountUsages).values({ discountId: l.id, userId: o.userId, orderId: o.id });
      }
      if (short.length) {
        // Money is already taken, so never refuse: flag it for the team.
        await tx.update(orders).set({ adminNote: `Stock short when paid: ${short.join(", ")}. Restock or contact the customer before packing.` }).where(eq(orders.id, o.id));
      }
    }
    if ((input.to === "cancelled" || input.to === "refunded") && input.restock && PAID_STATES.includes(o.status)) {
      const [already] = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(and(eq(stockMovements.orderId, o.id), eq(stockMovements.reason, "cancel")))
        .limit(1);
      if (!already) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
        for (const it of items) if (it.productId) await moveForOrderLine(tx, it.productId, it.qty, 1, o.id, o.number);
      }
    }

    const message =
      input.message?.trim() ||
      STATUS_MESSAGE[input.to] + (input.to === "shipped" && tracking ? ` India Post tracking: ${tracking}` : "");
    await tx.insert(orderEvents).values({ orderId: o.id, status: input.to, message, location: input.location || null, source: input.source ?? input.actor });

    return { ok: true, changed: true, from: o.status, order: updated };
  });

  // Side effects that must only run after the transaction commits
  if (result.ok && result.changed) {
    // Stock, trending and coupon use changed: every cached store read must be rebuilt.
    if (input.to === "paid" || input.to === "cancelled" || input.to === "refunded") await clearCache();
    if (input.to === "paid") await sendOrderConfirmation(db, input.orderId).catch((e) => console.warn("confirmation email failed", e));
    if (input.to === "shipped") await sendShippedEmail(db, input.orderId).catch((e) => console.warn("shipped email failed", e));
  }
  return result;
}

/** For callers that want an exception instead of a result. */
export async function transitionOrThrow(db: DB, input: TransitionInput) {
  const r = await transitionOrder(db, input);
  if (!r.ok) throw new OrderTransitionError(r.message);
  return r;
}
